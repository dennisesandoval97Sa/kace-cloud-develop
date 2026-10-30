# deploy-env

Levanta un entorno KACE desde cero o despliega una versión sobre uno existente con un
solo comando. Cada fase comprueba si ya está hecha y se salta; los outputs de
CloudFormation se escriben siempre en el archivo de entorno.

## Uso

```bash
git clone <repo> && cd kace-cloud && git checkout <tag>
cp .env.example .env.<entorno>      # rellena los valores NO derivados (BD, dominio, Cognito…)
pnpm run deploy:env -- .env.<entorno>
```

Primero, siempre, en seco:

```bash
pnpm run deploy:env -- .env.<entorno> --dry-run
```

En dry-run, `cognito-client` lista las URLs que añadiría al app client, `db-proxy-secrets` indica qué secretos crearía o asociaría en el RDS Proxy (usuarios por su clave del `.env`, nunca por su nombre) y `tenant-registration` indica si crearía el tenant o qué campos difieren (valores sensibles enmascarados).

## Fases

| Fase | Se salta si… | Qué hace |
|---|---|---|
| `preflight` | nunca | contrato de `.env.example` (sin claves derivadas), cuenta AWS, confirmación, genera `VITE_TENANT_ID` si falta, `pnpm install --frozen-lockfile` |
| `cdk-bootstrap` | existe `CDKToolkit` | `cdk bootstrap` |
| `infra-stack` | nunca (`@kace/aws-infra` no tiene `cdk:deploy`) | deploy de `@kace/aws-infra` + outputs de dominio al `.env` |
| `tenant-stack` | el stack está sano | deploy de `@kace/api-tenant` + ARN de la tabla al `.env` |
| `event-processor-stack` | el stack está sano | deploy de `@kace/api-event-processor` + bus y ARN/URL de las 7 colas al `.env` |
| `db-proxy-secrets` | `DB_HOST`/`DB_HOST_READER` no apuntan a un RDS Proxy (`no aplica`) o cada usuario ya tiene su secreto asociado | crea el secreto `{username,password}` de `DB_USER` y `DB_AUXILIAR_USER` (nombre = usuario), le da acceso al rol del proxy y lo añade a su lista `Auth` sin quitar nada |
| `migrations` | nunca (Knex es idempotente) | `migrate:latest` |
| `services` | nunca | `validate-env-deploy.sh` y `pnpm -r run --workspace-concurrency=<n> --report-summary cdk:deploy` (todos los paquetes con `cdk:deploy`, como `pnpm deploy`); `cdk:clean` solo si todo se desplegó |
| `cognito-client` | las URLs ya están | añade las URLs PROD del frontal al app client sin tocar el resto |
| `tenant-registration` | el item existe y es igual | `put-item` del tenant en DynamoDB |

Reanudar tras un fallo: `pnpm run deploy:env -- .env.<entorno> --from <fase>`.
Una sola fase: `--only <fase>`.

## Modo CI

```bash
pnpm run deploy:env -- "$ENV_FILE" --yes --expect-account "$AWS_ACCOUNT_ID"
```

`--yes` exige `--expect-account` y aborta si la cuenta activa no coincide. Sin TTY y sin `--yes`, el comando se niega a arrancar.

| Exit | Significado |
|---|---|
| 0 | OK (una fase en `aviso` también devuelve 0) |
| 1 | falló una fase |
| 2 | error de uso |
| 4 | abortado por el usuario |

## Garantías

- **El `.env`** solo cambia en las claves de `outputMap.mjs` y en `VITE_TENANT_ID`. Antes de la primera escritura se guarda una copia en `<archivo>.bak-<timestamp>`, y el diff se muestra enmascarado. Una línea `CAMBIA` indica que el archivo apuntaba a otra cosa: revísala.
- **Stacks:** el comando nunca borra ni cancela stacks. Un stack en `*_FAILED`, `ROLLBACK_COMPLETE` o `*_IN_PROGRESS` detiene la ejecución.
- **Cognito:** se reenvía la configuración completa del client, porque `update-user-pool-client` resetea lo que se omite. Solo se añaden URLs; nunca se quitan.
- **Tenant:** si ya existe y difiere, **no se sobrescribe** y la fase termina en `aviso`. Con `--overwrite-tenant` se fusiona `{...existente, ...generado}`, que conserva los campos extra.
- **RDS Proxy:** la lista `Auth` se relee justo antes de `modify-db-proxy` y se envía completa, porque la llamada la sustituye entera; antes se guarda una copia en `<archivo>.proxy-auth-<timestamp>.json`. Si un secreto existente no coincide con el `.env`, la fase para con error y no lo toca. Riesgo aceptado: dos despliegues que modifiquen el mismo proxy a la vez → gana el último. Los errores de AWS de esta fase sustituyen los nombres de usuario por `<DB_USER>`/`<DB_AUXILIAR_USER>`.

## RDS Proxy

La fase detecta el proxy comparando `DB_HOST` y `DB_HOST_READER` con los endpoints de los proxies de la región. Si alguno tiene forma de endpoint de RDS Proxy pero no coincide con ningún proxy de la cuenta y región activas, la fase falla en vez de quedar en `no aplica`: suele ser un perfil o una región AWS equivocados. Permisos que necesita: `rds:DescribeDBProxies`, `rds:DescribeDBProxyEndpoints`, `rds:ModifyDBProxy`, `secretsmanager:DescribeSecret`, `secretsmanager:GetSecretValue`, `secretsmanager:GetResourcePolicy`, `secretsmanager:CreateSecret` y `secretsmanager:PutResourcePolicy`. No crea el usuario en PostgreSQL.

Para que `DB_HOST` sea el endpoint del proxy y las migraciones locales sigan pasando por un túnel SSH, reenvía el túnel a una IP de loopback propia y resuelve ahí el nombre del proxy:

```
# ~/.ssh/config
Host tunel-postgres
    HostName <bastión>
    LocalForward 127.0.0.2:5432 <endpoint-del-proxy>:5432

# /etc/hosts
127.0.0.2  <endpoint-del-proxy>
```

Levanta el túnel en otra terminal antes de `migrations` y déjalo abierto mientras dure el despliegue:

```bash
ssh -N tunel-postgres                  # Ctrl+C lo cierra
nc -zv 127.0.0.2 5432                  # desde otra terminal: comprueba que escucha
```

Con `DB_HOST=<endpoint-del-proxy>` y `DB_PORT=5432`. El destino del `LocalForward` lo resuelve el bastión, así que la línea de `/etc/hosts` no afecta al túnel. Si el túnel está caído, la conexión falla en vez de caer en tu Postgres local.

## Claves de legado de `.env.example`

Ningún stack actual produce estas claves y el orquestador no las toca. Quedan pendientes de revisar:
`AWS_SQS_EVENTS_QUEUE_ARN`, `AWS_SQS_EVENTS_QUEUE_URL` y `AWS_EVENTBRIDGE_EVENT_BUS_URL`.

## Tests

```bash
node --test 'utils/deploy-env/test/*.test.mjs'
```
