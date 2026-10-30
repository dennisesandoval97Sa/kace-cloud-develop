# Solicitud de provisión del entorno `kace-cloudperf` para pruebas de carga F1-R

**Propósito:** Solicitamos la provisión de un entorno AWS dedicado (`kace-cloudperf`) para ejecutar pruebas de carga y establecer baselines de rendimiento del catálogo de ~91 servicios HTTP en `apps/apiv1/`.

**Referencia especificación:** `docs/superpowers/specs/2026-05-05-load-testing-apiv1-baseline-design.md` §5.1.

---

## Datos a solicitar al equipo de sysadmins

### Identificación del entorno

| Dato                             | Para qué sirve                        |
| -------------------------------- | ------------------------------------- |
| Nombre / alias del entorno       | Etiquetar baselines (`metadata.json`) |
| Cuenta AWS donde vive            | Validar costos y permisos             |
| Región AWS                       | Configurar SDK clients                |
| Fecha estimada de disponibilidad | Planificar inicio de F1               |
| Fecha de tear-down acordada      | No mantener costo indefinido          |

### API Gateway (acceso HTTP)

| Dato                                                                   | Para qué sirve                                                         |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `apiBaseUrl` (URL base del stage perf)                                 | Apuntar k6 a los endpoints                                             |
| API key (`x-api-key`)                                                  | Header obligatorio del API                                             |
| Lista de IPs/CIDR allowlisted o instrucciones de acceso (VPN, bastion) | Que las pruebas se puedan ejecutar desde donde el ejecutor las dispare |
| Throttling/quotas configuradas en el stage                             | Saber si el límite es del API Gateway o de la Lambda                   |

### Cognito (autenticación)

| Dato                                                                                                      | Para qué sirve                                    |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `userPoolId` perf                                                                                         | Generar tokens via SDK                            |
| `appClientId` perf con `USER_PASSWORD_AUTH` (o SRP) habilitado                                            | Hacer `InitiateAuth` desde el generador de tokens |
| 50 usuarios de prueba pre-creados (con credenciales conocidas) **O** permiso para crearlos via SDK        | Pool de tokens                                    |
| `tenantId` del tenant de prueba                                                                           | Header `TenantId` obligatorio                     |
| Confirmación de que ese tenant tiene los roles/permissions necesarios para todos los endpoints en alcance | Sin esto los escenarios devuelven 403             |

### Base de datos (RDS PostgreSQL)

| Dato                                                                                                     | Para qué sirve                                     |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Endpoint, puerto y nombre de DB                                                                          | Carga del snapshot anonimizado                     |
| Credenciales (rol con permisos `CREATE`/`INSERT`/`SELECT`/`DELETE` sobre el schema del tenant de prueba) | Seed inicial + cleanup post-mutating               |
| Tipo de instancia (sizing) y storage disponible (en GB)                                                  | Validar que cabe el snapshot prod (~32 GB asumido) |
| Confirmación de que la instancia **no es compartida** con tenants reales de producción                   | Evitar fugas y contención                          |
| Endpoint del bucket S3 cifrado donde se cargará el dump intermedio + IAM role para escribir/leer         | Pipeline de anonimización                          |

### Servicios desplegados

| Dato                                                                                                                                                                                           | Para qué sirve                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Confirmación de que **todos** los servicios `apps/apiv1/` están desplegados (~95 stacks), incluyendo los 4 excluidos del testing (`metrics`, `tenant`, `event_processor`, `imports_processor`) | Los event-driven son dependencias runtime: writes que disparan eventos fallarán si no están desplegados, falseando el baseline |
| Versión / commit-SHA desplegado                                                                                                                                                                | Reproducibilidad: anotado en `metadata.json` de cada baseline                                                                  |
| Sizing de Lambdas (memory, timeout, reserved concurrency) — debe ser igual o documentado-como-distinto vs producción                                                                           | Sin esto el baseline no es comparable con prod                                                                                 |

### Servicios accesorios

| Dato                                                                       | Para qué sirve                                                             |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Endpoint de RabbitMQ perf + credenciales                                   | Algunos endpoints publican mensajes; sin esto los writes pueden bloquearse |
| Buckets S3 perf (uploads, attachments) y permisos                          | Endpoints `upload_s3_files` / `download_s3_files`                          |
| **Mailer en modo sink** (SES sandbox o SMTP capturador tipo MailHog)       | Endpoints que envían correo no deben mandar email real                     |
| **Webhooks de salida en modo sink** (URL `httpbin.org/post` o equivalente) | Endpoints que invocan webhooks externos no deben golpear sistemas reales   |

### Observabilidad durante las pruebas

| Dato                                                         | Para qué sirve                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------------------- |
| Acceso de lectura a CloudWatch Logs/Metrics del entorno perf | Diagnosticar si un escenario falla por throttling, error de DB, etc. |
| Acceso a la consola AWS (read-only) o Grafana del equipo     | Observación en vivo durante pruebas largas                           |

### Operativa

| Dato                                                                    | Para qué sirve                                |
| ----------------------------------------------------------------------- | --------------------------------------------- |
| Persona/canal de contacto para incidentes                               | Si la prueba tira el entorno, a quién avisar  |
| Ventana horaria sugerida para pruebas                                   | No saturar al equipo si la prueba tarda horas |
| Procedimiento para refrescar el snapshot (cadencia trimestral planeada) | Coordinar con DBA                             |

---

## Datos que entregamos de vuelta a sysadmins

- **`pii-fields.json` revisado y aprobado por DBA + legal** — Catálogo de columnas a anonimizar antes del extract. Garantiza que no habrá fuga de datos personales a un entorno no-producción.

- **Estimación de carga máxima de la prueba** — 50 RPS constante por escenario, ejecutados con `--parallelism=6` (máximo 6 servicios en paralelo). Picos estimados de ~300 RPS sobre el conjunto del entorno. Esta información permite a sysadmins preasignar cuota de API Gateway y estimar costos.

- **Calendario tentativo de ejecuciones** — Fases F1-R, F2-R, F3-R planificadas. Permite que sysadmins se preparen y no saturen su equipo con solicitudes de soporte conflictivas.

---

## Almacenamiento de la información recibida

**Datos sensibles** (credenciales DB, IDs de cliente Cognito, API key, contraseñas de usuarios de prueba):

- Se guardan en **`.env.perf` local** (en la máquina donde se ejecutan las pruebas) + **1Password / secret manager del equipo**.
- **Nunca se commitean a git**. El `.gitignore` ya cubre `.env*`.
- Acceso: solo miembros del equipo de pruebas con permiso explícito.

**Datos no sensibles** (apiBaseUrl, userPoolId, tenantId, sizing de RDS, commit-SHA desplegado):

- Se reflejan en `metadata.json` de cada baseline publicado en `docs/perf/baselines/`.
- Commiteados en git (parte del histórico reproducible).
- Permiten que cualquier persona pueda saber contra qué infraestructura se ejecutó un baseline, sin necesidad de acceso a credenciales reales.
