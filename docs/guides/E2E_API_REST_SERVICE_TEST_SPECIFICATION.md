# Especificación de Tests E2E del API REST de los microservicios KACE Cloud

## Tabla de Contenidos

1. [Introducción](#1-introducción)
2. [Arquitectura de los tests E2E](#2-arquitectura-de-los-tests-e2e)
3. [Preparación del entorno](#3-preparación-del-entorno)
4. [Estructura del archivo de test](#4-estructura-del-archivo-de-test)
5. [Contrato del API que el test debe conocer](#5-contrato-del-api-que-el-test-debe-conocer)
6. [Patrones de test por operación](#6-patrones-de-test-por-operación)
7. [Casos transversales](#7-casos-transversales)
8. [Object Mothers](#8-object-mothers)
9. [Buenas prácticas](#9-buenas-prácticas)
10. [Plantilla base](#10-plantilla-base)
11. [Ejemplos de referencia](#11-ejemplos-de-referencia)
12. [Checklist de completitud](#12-checklist-de-completitud)
13. [Problemas conocidos](#13-problemas-conocidos)
14. [Recursos](#14-recursos)

---

## 1. Introducción

Este documento define cómo se escriben y se ejecutan los tests End-to-End (E2E) del API REST de los microservicios Lambda de `apps/apiv1/`. Un test E2E envía peticiones HTTP reales a un Lambda levantado con AWS SAM Local y comprueba la respuesta **y** el estado que queda en PostgreSQL.

### Objetivos

- Validar que cada endpoint responde con el status y el cuerpo que define su contrato.
- Verificar que las validaciones (Joi, value objects, reglas de negocio, unicidad) rechazan lo que deben y no persisten nada.
- Comprobar los efectos en base de datos: lo creado, lo actualizado, el borrado lógico.
- Detectar regresiones del comportamiento del API.

### Stack

- **Jest 29** con ESM (`--experimental-vm-modules`), archivos `.e2e.mjs`.
- **Axios** a través de `TestHelper` (`@kace/api-common`), que añade el token de Cognito y las cabeceras.
- **PostgreSQL + Knex** para sembrar y verificar.
- **AWS SAM Local** (Docker) para ejecutar el Lambda detrás de API Gateway.
- **Object Mothers** de `@kace/core/tests/` para los datos de prueba.

### Ejemplos de referencia

Dos suites implementan esta especificación completa, todas en verde contra SAM Local; ante cualquier duda, son la referencia ejecutable ([§11](#11-ejemplos-de-referencia)):

- `apps/apiv1/kace_cloud_api_ans/test/AnsApiE2E.e2e.mjs`: CRUD estándar (64 casos).
- `apps/apiv1/kace_cloud_api_users/test/UsersApiE2E.e2e.mjs`: CRUD con relaciones, filtro base de búsqueda y siete endpoints propios, varios sobre el usuario autenticado (112 casos).

---

## 2. Arquitectura de los tests E2E

### Flujo

```
┌──────────────── Jest (proceso del test) ────────────────┐
│ TestHelper.getTenant() → LocalTenantRepository → DB_TEST_*│
│ repository (siembra y verifica) ─────────────┐            │
│ TestHelper.getRequest/postRequest ──┐        │            │
└─────────────────────────────────────┼────────┼────────────┘
                                      │ HTTP   │ SQL
                                      ▼        ▼
┌──────────── SAM Local (Docker) ─────────┐  ┌──────────────────────┐
│ API Gateway → handler → withTenantContext│  │ PostgreSQL            │
│   → TenantContextManager                 │  │ base y esquema        │
│     → LocalTenantRepository (NODE_ENV=   │─▶│ de DB_TEST_*          │
│       local) → DB_TEST_*                 │  └──────────────────────┘
│   → Controller → Use case → Repository   │
└──────────────────────────────────────────┘
```

**Regla fundamental:** el test y el Lambda tienen que mirar la **misma** base, la del bloque `DB_TEST_*` del `.env`. El bloque `DB_*` es la base de desarrollo y un E2E nunca debe tocarlo: `resetSchemaAndMigrate` borra el esquema entero.

- El test resuelve el tenant con `TestHelper.getTenant()`, que usa `LocalTenantRepository` y solo lee `DB_TEST_*`.
- El Lambda usa `LocalTenantRepository` **solo si `NODE_ENV=local`**. Con cualquier otro valor resuelve el tenant en DynamoDB y acaba en la base de desarrollo. `NODE_ENV` se fija al sintetizar el stack a partir de `APPS_ENVIRONMENT` ([§3.2](#32-arrancar-el-lambda-en-modo-local-apie2e)).

### Componentes

| Componente | Origen | Uso en el test |
|---|---|---|
| `TestHelper` | `@kace/api-common/tests/helpers/TestHelper.js` | `getTenant()`, `resetSchemaAndMigrate()`, `getRequest()`, `postRequest()` |
| Repositorio Knex | `@kace/core/src/<contexto>/infrastructure/persistence/` | Sembrar datos y verificar el estado de la base |
| Object Mother | `@kace/core/tests/<contexto>/domain/<Entidad>Mother.js` | Construir DTOs y entidades de prueba |
| SAM Local | script `api:e2e` del servicio | Ejecutar el Lambda en Docker |

---

## 3. Preparación del entorno

### 3.1 Variables de entorno

Viven en el `.env` de la raíz. El `jest.config.js` de cada servicio lo carga en el proceso del test y CDK lo inyecta en el Lambda al sintetizar.

| Variable | La usa | Para qué |
|---|---|---|
| `DB_TEST_HOST`, `DB_TEST_PORT`, `DB_TEST_DATABASE`, `DB_TEST_NAME`, `DB_TEST_USER`, `DB_TEST_PASSWORD`, `DB_TEST_AUXILIAR_USER`, `DB_TEST_AUXILIAR_PASSWORD`, `DB_TEST_HOST_READER` | test y Lambda | Base del E2E. El host debe ser alcanzable **desde el contenedor** de SAM (red `kace_cloud_main_global-network`) **y** desde el host; en Linux sirve la IP del contenedor de Postgres en esa red y el puerto interno (5432) |
| `DB_TEST_SCHEMA` | test y Lambda | Esquema desechable. Debe cumplir `^(test_\|tmp_\|ci_\|kace_test($\|_)\|.*_w\d+$)` o `resetSchemaAndMigrate` se niega a borrarlo |
| `ALLOW_SCHEMA_RESET=true` | test | Autoriza el `DROP SCHEMA` de `resetSchemaAndMigrate` |
| `AWS_COGNITO_REGION`, `AWS_COGNITO_APP_CLIENT_ID` | test | Login en Cognito |
| `TEST_APP_USER`, `TEST_APP_PASSWORD` | test | Usuario de Cognito. Su `sub` tiene que coincidir con el `login` de un usuario sembrado en `packages/kace_cloud_database/seeds/20241125105900_usuario_base.js` (hoy, `tester@konecta.com`); si no, todas las peticiones devuelven 400 |
| `AWS_COGNITO_USER_POOL_ID` | Lambda | Verificar el JWT |
| `TEST_CLIENT_FINGERPRINT` | test | Cabecera `x-client-fingerprint` (opcional; por defecto `test-fingerprint`) |

Notas:

- `TEST_TENANT_ID` no influye en local: `LocalTenantRepository` ignora el id del tenant.
- `APPS_DEBUG=true` hace que, fuera de producción, los errores devuelvan su mensaje real. Los tests **no** deben depender de ello ([§5.4](#54-los-mensajes-de-error-son-genéricos)).
- Si `DB_TEST_*` apunta a la misma base y esquema que `DB_*`, el test debe abortar ([§3.4](#34-guardas-obligatorias)).

### 3.2 Arrancar el Lambda en modo local: `api:e2e`

El script `api` de los servicios no basta con el `.env` compartido:

- Con `APPS_ENVIRONMENT=staging` (o `production`) el Lambda resuelve el tenant en DynamoDB y escribe en la base de desarrollo, mientras el test siembra y borra en la de test. El síntoma son 404 sin explicación; el daño, datos de prueba en dev.
- `api` busca `cdk.out/<APPS_SERVICE_NAME><id del stack>.template.json` con un prefijo fijo (normalmente `DEVELOPMENT`). Con otro `APPS_SERVICE_NAME` en el `.env`, SAM no encuentra el template.

Cada servicio con E2E declara en su `package.json`:

```json
"api:e2e": "APPS_ENVIRONMENT=local APPS_SERVICE_NAME=DEVELOPMENT DB_HOST= DB_HOST_READER= DB_DATABASE= DB_NAME= DB_USER= DB_PASSWORD= DB_AUXILIAR_USER= DB_AUXILIAR_PASSWORD= DB_PORT= DB_SCHEMA= pnpm run api",
```

- `APPS_ENVIRONMENT=local` → el Lambda recibe `NODE_ENV=local` y usa `LocalTenantRepository` (`DB_TEST_*`).
- `APPS_SERVICE_NAME` debe producir el nombre de template que espera el script `api` del servicio. Si ese script usa otro prefijo (por ejemplo `DEVAPI…`), ajusta el valor.
- Las `DB_*` vacías: `dotenv` no sobrescribe variables ya definidas, así que salen vacías en el template. Ningún código del Lambda puede alcanzar la base de desarrollo y sus credenciales no acaban en `cdk.out`.

Comprobación tras el primer arranque (el template no debe mencionar el host, usuario ni esquema de dev):

```bash
grep -c "<host-de-dev>\|<usuario-de-dev>\|<esquema-de-dev>" cdk.out/DEVELOPMENT<Entidad>Stack.template.json   # → 0
```

### 3.3 Ejecutar la suite: `test:e2e`

```json
"test:e2e": "node --experimental-vm-modules node_modules/jest/bin/jest.js --detectOpenHandles --forceExit --runInBand --testTimeout=60000 --testMatch '**/*.e2e.mjs'",
```

- `--testMatch '**/*.e2e.mjs'`: los E2E quedan fuera de `pnpm run test` (que solo recoge `*.test.mjs`), así los unitarios no necesitan SAM levantado.
- `--runInBand`: todos los E2E de un servicio comparten un único esquema.
- `--testTimeout=60000`: SAM crea un contenedor por invocación. Medido en ANS: reset del esquema ≈ 4 s, cada petición ≈ 2,5 s (incluye el login en Cognito, que `TestHelper` no cachea) y picos esporádicos de hasta 45 s. Con 30 s la suite es inestable. Cuenta con unos 10 s por caso: ANS (64) tarda 11 min y users (112), 18.

```bash
cd apps/apiv1/kace_cloud_api_<servicio>
pnpm run api:e2e                      # terminal 1: SAM Local en modo local
pnpm run test:e2e                     # terminal 2: la suite completa
pnpm run test:e2e -t "POST / - Create"  # solo los tests cuyo nombre coincide
```

No hay `test:coverage` para E2E: el Lambda corre en otro proceso y Jest no puede medir su cobertura.

### 3.4 Guardas obligatorias

Todo E2E empieza con dos guardas en un `beforeAll` de nivel superior.

**1. Configuración:** el test solo arranca si apunta a `DB_TEST_*` y esa base no es la de desarrollo.

```javascript
if (!process.env.DB_TEST_HOST || !process.env.DB_TEST_SCHEMA) {
    throw new Error('El E2E necesita DB_TEST_HOST y DB_TEST_SCHEMA en el .env.');
}
if (process.env.DB_TEST_HOST === process.env.DB_HOST && process.env.DB_TEST_SCHEMA === process.env.DB_SCHEMA) {
    throw new Error('DB_TEST_* apunta a la misma base y esquema que DB_*: el E2E la reiniciaría.');
}
if (tenant.db_host.value !== process.env.DB_TEST_HOST || tenant.db_schema.value !== process.env.DB_TEST_SCHEMA) {
    throw new Error('TestHelper.getTenant() no está resolviendo DB_TEST_*.');
}
```

**2. Centinela:** demuestra que el Lambda lee la misma base que el test. Sin esta guarda, un Lambda mal arrancado produce decenas de 404 que no tienen nada que ver con lo que se prueba.

```javascript
await TestHelper.resetSchemaAndMigrate(tenant);
const sentinel = await <Entidad>Mother.create<Entidad>(repository);
const response = await TestHelper.getRequest(`${baseUrl}/${sentinel.id.value}`);
if (response.status !== HTTP.OK) {
    throw new Error(
        `El Lambda de SAM Local no ve la base DB_TEST_* (GET sentinel → ${response.status ?? response.code}). ` +
            'Arráncalo con `pnpm run api:e2e`.'
    );
}
```

---

## 4. Estructura del archivo de test

### 4.1 Ubicación y nombre

```
apps/apiv1/kace_cloud_api_<servicio>/
├── test/
│   ├── <Entidad>ApiE2E.e2e.mjs     # E2E (Guía B: *E2E*.e2e.mjs)
│   └── *.test.mjs                  # unitarios
├── src/
│   ├── handler.mjs
│   ├── controller.mjs
│   └── schemas.mjs
├── lib/<servicio>-stack.ts         # rutas extra del API Gateway
├── bin/<servicio>.ts               # id del stack
└── package.json                    # scripts api, api:e2e, test:e2e (--port = puerto del E2E)
```

El puerto está en el `--port` del script `api` del `package.json` del servicio. No existe `template.yaml`: el template lo genera `cdk synth` en `cdk.out/`.

### 4.2 Imports

Rutas directas a cada módulo, **nunca** barrels (`@kace/core/src/<contexto>` o el `index.js` de `@kace/api-common`), como exige `CLAUDE.md`:

```javascript
import { randomUUID } from 'node:crypto';
import { TestHelper } from '@kace/api-common/tests/helpers/TestHelper.js';
import { Knex<Entidad>Repository } from '@kace/core/src/<contexto>/infrastructure/persistence/Knex<Entidad>Repository.js';
import <Entidad>Mother from '@kace/core/tests/<contexto>/domain/<Entidad>Mother.js';
```

Para UUIDs basta `randomUUID` de `node:crypto`, sin depender de `uuid`.

### 4.3 Organización del archivo

```javascript
// 1. Imports y comentario de ENTORNO (qué base usa cada lado y cómo se ejecuta)

// 2. Tenant (top-level await)
const tenant = await TestHelper.getTenant();

// 3. Constantes y helpers de módulo
const HTTP = { OK: 200, CREATED: 201, BAD_REQUEST: 400, FORBIDDEN: 403, NOT_FOUND: 404 };
const SERVER_MANAGED_CREATE_FIELDS = ['id', 'created_at', 'created_by'];
const SEEDED_<ENTIDAD>_COUNT = 1; // filas que siembran los seeds, con el archivo en un comentario
const createPayload = (overrides = {}) => { /* §8.3 */ };
const totalOf = (response) => Number(response.data.metadata.count.count); // su forma depende del servicio: §5.1
const searchCriteria = (overrides = {}) => ({ /* §6.6 */ });

// 4. Suite principal
describe('<Entidad>Controller E2E tests', () => {
    const repository = new Knex<Entidad>Repository(tenant.buildKnexConfig());
    const baseUrl = 'http://127.0.0.1:<PUERTO>';

    const find<Entidad>By = (where) => repository.table().where(where).first();

    beforeAll(async () => { /* guardas de §3.4 */ });

    afterAll(async () => {
        await repository.destroyConnection();
    });

    describe('POST / - Create <Entidad>', () => { /* ... */ });
    describe('GET /:id - Read <Entidad> by ID', () => { /* ... */ });
    describe('POST /:id - Update <Entidad>', () => { /* ... */ });
    describe('GET /:id/delete - Delete <Entidad> (Soft Delete)', () => { /* ... */ });
    describe('GET / - Index <Entidad> (List with default criteria)', () => { /* ... */ });
    describe('POST /search - Search <Entidad> with custom criteria', () => { /* ... */ });
    describe('Error handling and edge cases', () => { /* ... */ });
    describe('Data integrity and consistency', () => { /* ... */ });
});
```

Cada `describe` de operación resetea el esquema en su `beforeEach`:

```javascript
beforeEach(async () => {
    await TestHelper.resetSchemaAndMigrate(tenant);
});
```

### 4.4 Acceso a la base desde el test

- Consultas con `repository.table()`, que cualifica el esquema. **Nunca** `repository.connection(repository.tableName)`: sin `search_path` apunta a `public`.
- Cierre con `repository.destroyConnection()`, que cierra también el pool lector. Sin `try/catch` ni `console.log` (ESLint `no-console`).

---

## 5. Contrato del API que el test debe conocer

### 5.1 Qué devuelve `TestHelper`

`getRequest()` y `postRequest()` nunca lanzan:

| Resultado | Qué devuelven | Status | Cuerpo |
|---|---|---|---|
| 2xx | `AxiosResponse` | `response.status` | `response.data` |
| 4xx / 5xx | `AxiosError` | `response.status` | `response.response.data` |
| Sin conexión (SAM caído) | `AxiosError` | `undefined` (mira `response.code`, p. ej. `ECONNREFUSED`) | — |

Por eso las aserciones de error usan `expect(response).toHaveProperty('status', 400)` y no hace falta `try/catch`.

Forma del cuerpo en los endpoints CRUD estándar:

| Endpoint | Cuerpo |
|---|---|
| `GET /{id}` | `{ message, data: <entidad>, metadata }` |
| `GET /`, `POST /search` | `{ message, data: { items: [...] }, metadata: { count: <total>, ... } }` |
| `POST /` | `201`; según el controlador, `data` va vacío (ANS) o trae el id generado (users: `data.id`) |
| Error | `{ message: <genérico>, data: { code: <código público> }, metadata: { request_id }, errors }` |

`metadata.count` **no tiene una forma única**; depende de cómo cuente el caso de uso de cada endpoint:

| Forma | Origen | Ejemplos |
|---|---|---|
| `{ count: '2' }` | El caso de uso devuelve la fila cruda de `COUNT(*)` de `KnexRepository.count()` | ANS: `GET /` y `POST /search` |
| `'2'` (string) | El caso de uso desenvuelve la fila pero no la convierte | users: `GET /` y `POST /search` |
| `2` (número) | El caso de uso cuenta en memoria o convierte el valor | users: `POST /searchByName`; `POST /{id}/history` en todos |

Compruébala en el primer test de cada endpoint y léela siempre con un helper, para que, si algún día se normaliza, solo cambie una línea:

```javascript
// KnexRepository.count() devuelve la fila cruda de COUNT(*), así que el total llega como { count: '2' }.
const totalOf = (response) => Number(response.data.metadata.count.count);
```

Lo mismo vale para el resto del cuerpo: dos endpoints del mismo servicio pueden serializar un campo de forma distinta. En users, `GET /{id}` devuelve los contadores de casos como números (`expiredCases: 0`) y `GET /` como objetos (`expiredCases: { count: 0 }`). No reutilices una expectativa entre endpoints sin comprobarla.

### 5.2 Campos gestionados por el servidor

Los controladores que crean con `secureObjectCreatePayload` (`@kace/api-common/src/security/ObjectIdentityAuthorization.js`):

- **Reemplazan el `id` del cliente** por uno generado en el servidor (salvo que el controlador active `allowLegacyId`).
- Descartan `created_*`, `updated_*`, `deleted_*` y `tenant_id` del payload y fijan `created_at` y `created_by` en el servidor.

Consecuencias para el test:

- Un test de "IDs duplicados" en el create no tiene sentido. Lo que se prueba es que **el id del cliente se ignora** ([§6.1](#61-create-post-)).
- Si el `201` devuelve el id generado (users), el test lo usa para buscar la fila; si no (ANS), la localiza por un campo único, como el nombre.
- El payload HTTP se construye sin esos campos ([§8.3](#83-del-dto-del-mother-al-payload-http)).

En el update, cada controlador decide. En ANS y en users, el esquema de update no admite `created_by` y el payload que lo trae se rechaza con 400.

### 5.3 De error a status HTTP

| Origen del error | Status |
|---|---|
| Joi (`HttpResponse.validationsFail`) | 400 |
| `ValidationFailError` (unicidad, reglas de negocio, "no existe" en muchos casos de uso) | 400 |
| `DomainError` / `InvalidArgumentError` (value objects y guards) | su `statusCode` (400 por defecto) |
| `CustomError`, `AuthFailError`, `QueryDBError` | su `statusCode` |
| `Error` genérico | **500**; casi siempre es un defecto del servicio |
| Finder que no encuentra en `GET /{id}` | 404 |
| UUID inválido en la ruta (`validateId`) | 400 |
| Ruta que no encaja con ninguna plantilla de API Gateway (`GET /{uuid}/invalid`) | 403 (lo responde API Gateway/SAM, no el Lambda) |
| Ruta de un solo segmento sin recurso propio (`POST /advance-search` en users) | La captura `/{id}`: 400 por id inválido |
| Relación inexistente en `secureObjectCreatePayload` | 404 |

Actualizar o borrar una entidad que no existe **no siempre** da 404: en ANS da 400 porque el caso de uso lanza `ValidationFailError`; en users, el update da 404. El test fija el contrato actual; si parece incorrecto, se reporta, pero no se escribe un test que espere otra cosa.

**Obligatorio no es solo `.required()` en Joi.** Un campo que Joi deja pasar puede exigirlo el dominio: el value object lo rechaza (400), el caso de uso lo usa sin comprobarlo (en users, `login` en la validación de unicidad) o un constructor lanza un `Error` genérico (500, un defecto). En users, Joi solo exige `account_type` y `group_ids`, pero `is_active` y `login` también son obligatorios. Para saber cuáles lo son, sondea cada campo ([§9](#9-buenas-prácticas)) en lugar de leer solo el esquema.

El esquema de update también puede exigir campos en una actualización parcial: el de users exige `account_type` aunque solo cambie el nombre. Encapsúlalo en un helper (`updatePayload(fields)`) y fíjalo con un test.

### 5.4 Los mensajes de error son genéricos

`Response` sustituye el mensaje por uno genérico ("Bad request", "Not found"…) salvo que el runtime no sea productivo **y** `APPS_DEBUG=true`. Por tanto:

- ❌ `expect(response.response.data.message).toContain('vencido debe ser mayor que intermedio')`
- ✅ El status, el código público (`response.response.data.data.code`, constantes de `@kace/error-codes`, que hay que añadir como dependencia del servicio) y, sobre todo, **el estado de la base**: que no se persistió nada o que no cambió nada.

### 5.5 Datos sembrados

`resetSchemaAndMigrate` ejecuta todas las migraciones **y todos los seeds** de `@kace/database`: usuarios, roles, estados por defecto, un ANS `Basic`, una clasificación… Nunca supongas que una tabla está vacía tras el reset:

- Declara una constante con las filas sembradas y el archivo que las crea:

  ```javascript
  // Fila que siembra 20260312120000_insert_default_estados.js en cada reset.
  const SEEDED_ANS_COUNT = 1;
  ```

- O filtra por los datos que crea el propio test.
- Evita colisiones de unicidad con los datos sembrados (en ANS: nombre `Basic`, combinación `5/10/Minutes`).
- Importa los ids y valores que exportan los seeds en lugar de copiarlos:

  ```javascript
  import { globalTesterUser } from '@kace/database/seeds/20241125105900_usuario_base.js';
  import { globalGroupId } from '@kace/database/seeds/20250128045401_rel_user_group.js';
  ```

  El servicio debe tener `@kace/database` entre sus dependencias.

### 5.6 Permisos

`resetSchemaAndMigrate` concede al rol global **todos** los permisos de `agente` y `administrador`. Un 403 por falta de permiso no se puede provocar en un E2E sin manipular el rol: se prueba en los tests unitarios del controlador.

Los permisos de búsqueda avanzada (`<Módulo>SearchAdvanced`) **no** se conceden por defecto; se piden así:

```javascript
await TestHelper.resetSchemaAndMigrate(tenant, { searchPermissionNames: ['AnsSearchAdvanced'] });
```

### 5.7 Búsquedas: esquema y allowlist

`POST /search` pasa por dos filtros antes de llegar al repositorio:

1. **`SearchSchema`** (`@kace/api-common/src/validation/schemas/SearchSchema.js`) → 400 si falla.
   - `limit` y `offset` son obligatorios (admiten `null`).
   - Operadores: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `between`, `in`, `notIn`, `like`, `ilike`, `null`, `notNull` y los `json*`.
   - `value` acepta string, número o booleano, **no arrays**: un `in` con `[1, 2]` devuelve 400.
   - `type`: `AND` u `OR`.
2. **`SearchAuthorizationService`** + `SearchPolicyRegistry` → 403 si falla. Sin el permiso `<Módulo>SearchAdvanced`:
   - **Filtro base** (`baseFilter`): si la política lo declara, cada búsqueda debe incluirlo **literalmente** (mismo `field`, `operator`, `value` y `type`) y sin filtros `OR`; si falta, 403.
   - **Allowlist** (`allowedFilters`): solo se admiten esos pares campo/operador, con coincidencia **exacta** del nombre del campo tal como lo declara la política. Unas usan el campo cualificado (ANS: `ans.id`) y otras no (users: `id`, `login`).
   - **Campos propios** de la consulta (fuera de `filter`, `limit`, `offset`, `order`…): solo los de `customQueryFieldAllowlists` (users: `name` en `POST /searchByName`).

Consulta la política del endpoint en `SearchPolicyRegistry.js` (clave `<servicio>.search`) antes de escribir los filtros. Ejemplos:

| Endpoint | Filtro base | Allowlist (extracto) |
|---|---|---|
| `ans.search` | — | `ans.id eq`, `ans.nombre ilike`, `ans.intermedio eq`, `ans.status eq/neq`; **no** `ans.nombre eq` ni `like` |
| `users.search` | `{ field: 'usuarios.deleted_at', operator: 'null', value: 'null', type: 'AND' }` | `id eq/in`, `login eq/like/ilike`, `email eq/like/ilike`, `nombres ilike`, `is_active eq`; **no** `telefono` ni `grupos_ids` |

Con un filtro base, mételo en el helper de criterios para que todos los tests lo envíen y el de "falta el filtro base" lo quite a propósito:

```javascript
// users.search exige este filtro base exacto a quien no tiene UsersSearchAdvanced.
const SEARCH_BASE_FILTER = { field: 'usuarios.deleted_at', operator: 'null', value: 'null', type: 'AND' };

const searchCriteria = ({ filter = [], ...overrides } = {}) => ({
    filter: [SEARCH_BASE_FILTER, ...filter],
    relationship: null,
    limit: 10,
    offset: 0,
    order: { field: 'created_at', direction: 'desc' },
    ...overrides,
});
```

---

## 6. Patrones de test por operación

Los ejemplos salen de `AnsApiE2E.e2e.mjs`. Para otra entidad, cambia los campos y las reglas.

### 6.1 CREATE (`POST /`)

Casos:

- Creación correcta **verificando en la base** cada campo persistido.
- El `id` del cliente se reemplaza.
- Los campos de auditoría del cliente se ignoran.
- Payload vacío → 400.
- Cada campo obligatorio ausente → 400 (`it.each`), incluidos los que exige el dominio y no Joi ([§5.3](#53-de-error-a-status-http)).
- Tipo incorrecto, longitud máxima, caracteres no permitidos, valor fuera del catálogo o la allowlist → 400.
- Relaciones (grupos, rol…) inexistentes → el status del contrato y **nada persistido**, tampoco las filas de relación.
- Caracteres especiales válidos (tildes, ñ) → 201.
- Cada regla de negocio → 400 **y nada persistido**.
- Cada restricción de unicidad → 400 y una sola fila.
- Dos creaciones concurrentes de entidades distintas → 201 ambas.

```javascript
it('should create an ANS and persist every field', async () => {
    // Arrange
    const payload = createPayload({ nombre: 'Ans Oro' });

    // Act
    const response = await TestHelper.postRequest(baseUrl, payload);

    // Assert
    expect(response.status).toBe(HTTP.CREATED);
    const persisted = await findAnsBy({ nombre: 'Ans Oro' });
    expect(persisted).toMatchObject({
        intermedio: payload.intermedio,
        vencido: payload.vencido,
        medicion_ans_id: payload.medicion_ans_id,
        status: payload.status,
        updated_at: null,
        deleted_at: null,
    });
    expect(persisted.created_by).not.toBeNull();
});

it('should replace a client-supplied id with a server-generated one', async () => {
    // Arrange
    const clientId = randomUUID();
    const payload = createPayload({ id: clientId, nombre: 'Ans Oro' });

    // Act
    const response = await TestHelper.postRequest(baseUrl, payload);

    // Assert
    expect(response.status).toBe(HTTP.CREATED);
    expect(await findAnsBy({ id: clientId })).toBeUndefined();
    expect((await findAnsBy({ nombre: 'Ans Oro' })).id).not.toBe(clientId);
});

it.each(['nombre', 'intermedio', 'vencido', 'medicion_ans_id'])(
    'should return 400 when required field %s is missing',
    async (field) => {
        // Arrange
        const payload = createPayload();
        delete payload[field];

        // Act
        const response = await TestHelper.postRequest(baseUrl, payload);

        // Assert
        expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
    }
);

it('should return 400 and persist nothing when intermedio is not lower than vencido', async () => {
    // Arrange
    const payload = createPayload({ nombre: 'Ans Invertido', intermedio: 20, vencido: 10 });

    // Act
    const response = await TestHelper.postRequest(baseUrl, payload);

    // Assert
    expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
    expect(await findAnsBy({ nombre: 'Ans Invertido' })).toBeUndefined();
});

it('should return 400 when nombre already exists', async () => {
    // Arrange
    await AnsMother.createAns(repository, { nombre: 'Ans Oro' });
    const payload = createPayload({ nombre: 'Ans Oro', intermedio: 1, vencido: 2 });

    // Act
    const response = await TestHelper.postRequest(baseUrl, payload);

    // Assert
    expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
    expect(await countAnsBy({ nombre: 'Ans Oro' })).toBe(1);
});
```

En las creaciones concurrentes, los payloads deben ser distintos en **todos** los campos con unicidad (en ANS, el nombre y la combinación intermedio/vencido/medición); si no, el test prueba la regla de unicidad, no la concurrencia.

### 6.2 READ (`GET /{id}`)

Casos:

- Lectura correcta comparando el cuerpo **completo** con `toEqual`.
- Inexistente → 404.
- Id que no es UUID → 400.

```javascript
it('should fetch an ANS with every field', async () => {
    // Arrange
    const ans = await AnsMother.createAns(repository);

    // Act
    const response = await TestHelper.getRequest(`${baseUrl}/${ans.id.value}`);

    // Assert
    expect(response.status).toBe(HTTP.OK);
    const { created_at: createdAt, ...data } = response.data.data;
    expect(data).toEqual({
        id: ans.id.value,
        nombre: ans.nombre.value,
        // ...resto de campos de negocio
        created_by: ans.created_by.value,
        updated_at: null,
        updated_by: null,
    });
    expect(new Date(createdAt).toISOString()).toBe(new Date(ans.created_at.value).toISOString());
});
```

Las fechas se comparan como instantes (`new Date(...).toISOString()`): Postgres las devuelve con otra precisión o zona que el valor sembrado.

La comprobación aparte de "todos los campos requeridos presentes" sobra: el `toEqual` completo ya la cubre.

### 6.3 UPDATE (`POST /{id}`)

Casos:

- Actualización correcta, verificada en la base.
- Solo cambian los campos enviados.
- `created_*` se conservan y `updated_*` se rellenan (`updated_by` con el id del usuario autenticado).
- Campos que el esquema exige incluso en una actualización parcial, si los hay ([§5.3](#53-de-error-a-status-http)).
- Tipo incorrecto → 400.
- Campo obligatorio vacío → 400.
- Valor que rechaza el value object → 400 **y los datos originales intactos**.
- Regla de negocio violada en el mismo payload → 400 y sin cambios.
- Payload con campos gestionados por el servidor → el status que defina el esquema (en ANS, 400).
- Id que no es UUID → 400.
- Entidad inexistente → el contrato actual ([§5.3](#53-de-error-a-status-http)).

```javascript
it('should return 400 and keep the original data when nombre contains digits', async () => {
    // Arrange
    const ans = await AnsMother.createAns(repository);

    // Act
    const response = await TestHelper.postRequest(`${baseUrl}/${ans.id.value}`, { nombre: 'Ans123' });

    // Assert
    expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
    expect((await findAnsBy({ id: ans.id.value })).nombre).toBe(ans.nombre.value);
});

it('should keep the creation audit fields and set the update ones', async () => {
    // Arrange
    const ans = await AnsMother.createAns(repository);

    // Act
    await TestHelper.postRequest(`${baseUrl}/${ans.id.value}`, { nombre: 'Ans Auditado' });

    // Assert
    const fetched = await TestHelper.getRequest(`${baseUrl}/${ans.id.value}`);
    expect(fetched.data.data.created_by).toBe(ans.created_by.value);
    expect(fetched.data.data.updated_at).not.toBeNull();
    expect(fetched.data.data.updated_by).not.toBeNull();
});
```

### 6.4 DELETE (`GET /{id}/delete`)

En KACE Cloud el borrado es lógico: rellena `deleted_at` y `deleted_by`. Va por `GET` porque Seguridad de la Información solo autoriza `GET` y `POST`.

Casos:

- Borrado correcto: 200, la fila **sigue existiendo** y tiene `deleted_at` y `deleted_by`.
- Leer una entidad borrada → 404.
- Id que no es UUID → 400.
- Entidad inexistente → el contrato actual.

```javascript
it('should soft delete an ANS keeping the row with deleted_at and deleted_by', async () => {
    // Arrange
    const ans = await AnsMother.createAns(repository);

    // Act
    const response = await TestHelper.getRequest(`${baseUrl}/${ans.id.value}/delete`);

    // Assert
    expect(response.status).toBe(HTTP.OK);
    const row = await findAnsBy({ id: ans.id.value });
    expect(row.deleted_at).not.toBeNull();
    expect(row.deleted_by).not.toBeNull();
});
```

### 6.5 INDEX (`GET /`)

Criterio por defecto de los controladores: sin filtros, `limit: 10`, `offset: 0`, orden `created_at desc`.

Casos:

- Lista con su total (contando los datos sembrados).
- Como mucho 10 elementos, pero el total cuenta todos.
- Orden `created_at desc`, con fechas **explícitas**.
- No devuelve borrados, ni en `items` ni en el total.

```javascript
it('should return at most 10 items while counting all of them', async () => {
    // Arrange
    for (let i = 0; i < 12; i++) {
        await AnsMother.createRandomAns(repository);
    }

    // Act
    const response = await TestHelper.getRequest(baseUrl);

    // Assert
    expect(response.status).toBe(HTTP.OK);
    expect(response.data.data.items).toHaveLength(10);
    expect(totalOf(response)).toBe(SEEDED_ANS_COUNT + 12);
});

it('should order items by created_at desc', async () => {
    // Arrange
    const older = await AnsMother.createAns(repository, {
        nombre: 'Ans Antiguo',
        created_at: '2030-01-01T00:00:00.000Z',
    });
    const newer = await AnsMother.createAns(repository, {
        nombre: 'Ans Reciente',
        intermedio: 1,
        vencido: 2,
        created_at: '2030-01-02T00:00:00.000Z',
    });

    // Act
    const response = await TestHelper.getRequest(baseUrl);

    // Assert
    expect(response.status).toBe(HTTP.OK);
    expect(response.data.data.items.slice(0, 2).map((item) => item.id)).toEqual([newer.id.value, older.id.value]);
});
```

Las fechas futuras dejan a las entidades sembradas detrás; un `setTimeout` entre creaciones no garantiza el orden.

### 6.6 SEARCH (`POST /search`)

Payload base:

```javascript
const searchCriteria = (overrides = {}) => ({
    filter: null,
    relationship: null,
    limit: 10,
    offset: 0,
    order: { field: 'created_at', direction: 'desc' },
    ...overrides,
});
```

Cada filtro tiene la forma `{ field: '<tabla>.<campo>', operator, value, type: 'AND' | 'OR' }`; se admiten grupos `{ groupType, filters }`. Antes de elegirlos, revisa la [§5.7](#57-búsquedas-esquema-y-allowlist).

Casos:

- Por id cualificado (`<tabla>.id eq`) → exactamente esa entidad y total 1.
- Por texto parcial (`ilike`, si está en la allowlist).
- Varios filtros con `AND` → solo la que cumple todos (crea también una que cumpla solo uno).
- Sin coincidencias → `items: []` y total 0.
- Paginación: `limit` y `offset` sobre un orden explícito, comprobando **la página exacta** y el total.
- No devuelve borrados.
- `limit` no numérico → 400.
- Operador inexistente → 400.
- Sin el filtro base, si la política lo declara → 403.
- Filtro fuera de la allowlist sin permiso avanzado → 403.
- El mismo filtro con `<Módulo>SearchAdvanced` → 200.
- Pseudofiltros que el caso de uso interpreta aparte (users: `grupos_ids`) → su efecto real.

```javascript
it('should paginate with limit and offset over a custom order', async () => {
    // Arrange
    const names = ['Ans Alfa', 'Ans Bravo', 'Ans Charlie', 'Ans Delta'];
    for (const [index, nombre] of names.entries()) {
        await AnsMother.createAns(repository, { nombre, intermedio: index + 1, vencido: index + 10 });
    }
    const criteria = searchCriteria({
        filter: [{ field: 'ans.nombre', operator: 'ilike', value: 'Ans %', type: 'AND' }],
        limit: 2,
        offset: 1,
        order: { field: 'nombre', direction: 'asc' },
    });

    // Act
    const response = await TestHelper.postRequest(`${baseUrl}/search`, criteria);

    // Assert
    expect(response.status).toBe(HTTP.OK);
    expect(response.data.data.items.map((item) => item.nombre)).toEqual(['Ans Bravo', 'Ans Charlie']);
    expect(totalOf(response)).toBe(names.length);
});

it('should return 403 when a filter is outside the allowlist and the user lacks advanced search', async () => {
    // Arrange
    const ans = await AnsMother.createAns(repository);
    const criteria = searchCriteria({
        filter: [{ field: 'id', operator: 'eq', value: ans.id.value, type: 'AND' }],
    });

    // Act
    const response = await TestHelper.postRequest(`${baseUrl}/search`, criteria);

    // Assert
    expect(response).toHaveProperty('status', HTTP.FORBIDDEN);
});

it('should accept a filter outside the allowlist when the user has AnsSearchAdvanced', async () => {
    // Arrange
    await TestHelper.resetSchemaAndMigrate(tenant, { searchPermissionNames: ['AnsSearchAdvanced'] });
    const ans = await AnsMother.createAns(repository);
    const criteria = searchCriteria({
        filter: [{ field: 'id', operator: 'eq', value: ans.id.value, type: 'AND' }],
    });

    // Act
    const response = await TestHelper.postRequest(`${baseUrl}/search`, criteria);

    // Assert
    expect(response.status).toBe(HTTP.OK);
    expect(response.data.data.items.map((item) => item.id)).toEqual([ans.id.value]);
});
```

### 6.7 Endpoints adicionales

Los stacks montan además `POST /{id}/history` y `POST /advance-search` (implementación por defecto en `BaseController`), y cada servicio puede declarar rutas propias en `lib/<servicio>-stack.ts`. Todo endpoint montado necesita su `describe`, con el mismo esquema: caso correcto verificado en la base, validaciones, id inválido e inexistente.

Cuidado con `advance-search`: la implementación de `BaseController` comprueba el permiso `administrador/users/UsersRead` sea cual sea el servicio y devuelve las filas **crudas** de la tabla, con todas sus columnas. Si tu servicio la monta, pruébala y revisa qué columnas expone; si nadie la usa, lo correcto es no montarla (users dejó de hacerlo porque devolvía tokens y claves de sesión).

Antes de escribirlo, comprueba dos cosas:

1. **Que la ruta se monta.** SAM imprime `Mounting … at http://127.0.0.1:<puerto>/<ruta>` al arrancar. En ANS, `setExtraResources` declara `/calculate` y `/types`, pero `KApiStack` nunca lo llama y esas rutas no existen.
2. **Que el handler la enruta.** Una ruta montada que `handler.mjs` no asigna a ningún controlador cae en el `Controller` por defecto, cuyo `BaseController` solo reconoce las rutas CRUD: responde 404. Así estaba `POST /session` en users hasta que se desmontó.

Si cambias las rutas de un stack, cambia también su entrada en `packages/kace_cloud_local_server/src/service-manifest.mjs`: el servidor local monta lo que dice ese manifiesto, no lo que dice el stack.

#### Endpoints que actúan sobre el usuario autenticado

Algunos endpoints no reciben un id: operan sobre quien hace la petición (en users, `POST /session/alive`, `GET /session/validate-group` y `POST /update-active-group`). En el E2E ese usuario es el de Cognito, sembrado como `tester@konecta.com`:

- Localízalo por un valor exportado del seed, nunca por un id copiado:

  ```javascript
  const findTester = () => findUserBy({ email: globalTesterUser });
  ```

- Prepara su estado escribiendo en la base (`repository.table().where({ email: globalTesterUser }).update(...)`); el reset del siguiente test lo restaura.
- Comprueba los efectos sobre él (`last_seen_at`, `grupo_activo`) y que **no** se tocó a ningún otro usuario.
- Nunca lo desactives ni lo borres: todas las peticiones siguientes del test devolverían 400 al autenticarse.
- Úsalo también para afirmar la auditoría: `created_by`, `updated_by` y `deleted_by` deben ser su id.

---

## 7. Casos transversales

Cada caso va **una sola vez**, en la sección de su operación o en una de estas dos. No dupliques tests entre secciones.

### 7.1 Errores y casos límite

| Caso | Resultado esperado |
|---|---|
| Ruta inexistente (`GET /{uuid}/invalid`) | 403 (API Gateway) |
| Segmento de ruta que no es UUID (`GET /123-456-789`) | 400 |
| Texto muy largo (10 000 caracteres) | 400 |
| Campo opcional omitido | 201 |
| Campo opcional a `null` | Lo que diga el esquema Joi: 201 solo si tiene `.allow(null)`. En ANS, `status: null` → 400 |
| SQL injection en un campo del body | El status que dicten las validaciones **y** la tabla intacta |
| SQL injection en el `value` de una búsqueda | 200, sin resultados (se trata como literal) y la tabla intacta |
| XSS en un campo de texto | El status que dicten las validaciones; si se acepta, se guarda tal cual |

No escribas aserciones del tipo `expect([201, 400]).toContain(...)`: decide qué hace el servicio y fíjalo. Si un campo solo admite letras, la inyección y el XSS dan 400.

```javascript
it('should treat SQL injection in a search value as a literal', async () => {
    // Arrange
    await AnsMother.createAns(repository);
    const criteria = searchCriteria({
        filter: [{ field: 'ans.nombre', operator: 'ilike', value: "%'; DROP TABLE ans; --", type: 'AND' }],
    });

    // Act
    const response = await TestHelper.postRequest(`${baseUrl}/search`, criteria);

    // Assert
    expect(response.status).toBe(HTTP.OK);
    expect(response.data.data.items).toEqual([]);
    expect(await countAnsBy({})).toBe(SEEDED_ANS_COUNT + 1);
});
```

`TestHelper` solo tiene `getRequest` y `postRequest`, así que un método no permitido (`PUT`, `DELETE`) no se puede probar desde aquí. Tampoco hace falta: el API solo expone `GET` y `POST`.

### 7.2 Integridad y consistencia

- **Actualizaciones concurrentes:** dos `POST /{id}` simultáneos → ambos 200 y queda exactamente uno de los dos valores.
- **Claves foráneas** (si la entidad las tiene): con FK válida → 201; con FK inexistente o borrada lógicamente → 404 (`assertAuthorizedRelationships`) y nada persistido. Cubre todos los endpoints que aceptan la FK, `bulk-update` incluido.
- **FK guardada en el update:** los formularios reenvían todos los campos, así que reenviar sin cambios una FK que apunta a una fila borrada después → 200. El update solo valida las relaciones que cambian; cambiar a una fila borrada sigue siendo 404.
- **Rollback de transacciones:** un E2E no puede provocar un fallo a mitad de una transacción. Se prueba en los tests de integración del caso de uso en `@kace/core`, no aquí.
- **Datos intactos tras un fallo** y **campos de auditoría**: ya están en UPDATE ([§6.3](#63-update-post-id)); no se repiten.

```javascript
it('should apply exactly one of two concurrent updates', async () => {
    // Arrange
    const ans = await AnsMother.createAns(repository);

    // Act
    const responses = await Promise.all([
        TestHelper.postRequest(`${baseUrl}/${ans.id.value}`, { nombre: 'Ans Primero' }),
        TestHelper.postRequest(`${baseUrl}/${ans.id.value}`, { nombre: 'Ans Segundo' }),
    ]);

    // Assert
    expect(responses.map((response) => response.status)).toEqual([HTTP.OK, HTTP.OK]);
    expect(['Ans Primero', 'Ans Segundo']).toContain((await findAnsBy({ id: ans.id.value })).nombre);
});
```

---

## 8. Object Mothers

### 8.1 Qué son y dónde están

Un Object Mother centraliza la creación de datos de prueba: `packages/kace_cloud_core/tests/<contexto>/domain/<Entidad>Mother.js`. Expone métodos estáticos:

| Método | Devuelve | Uso |
|---|---|---|
| `dto(overrides)` | DTO con valores por defecto | Base de payloads HTTP |
| `create<Entidad>(repository, overrides)` | Entidad guardada **directamente** con el repositorio | Arrange de read, update, delete, index y search |
| `randomDto()` / `createRandom<Entidad>(repository)` | Lo mismo con valores aleatorios (Chance) | Volumen (paginación) |

### 8.2 Cuidados

- `create<Entidad>()` escribe con el repositorio: **se salta** el controlador, Joi, las reglas de negocio y la unicidad. Sirve para preparar el estado, nunca para probar validaciones.
- Los valores aleatorios pueden colisionar con reglas de unicidad cuando la creación pasa por el API. Para lo que crea el API, usa valores fijos y distintos entre sí.
- Los valores por defecto del Mother no deben chocar con los datos sembrados ([§5.5](#55-datos-sembrados)).
- Algunos `create<Entidad>()` hacen más que guardar: `UsersMother.createUser()` crea antes las filas padre (roles, grupos) con SQL sin esquema (`connection(table)`). Contra la conexión del E2E, que no tiene `search_path`, fallan con `relation "roles" does not exist`. En ese caso, construye la entidad con el `dto()` del Mother y guárdala con el repositorio, cuyas consultas sí cualifican el esquema:

  ```javascript
  // UsersMother.createUser() crea las filas padre con SQL sin esquema y, sin search_path, apunta a
  // `public`: el usuario se construye con el Mother y se guarda con el repositorio.
  const createUser = async (overrides = {}) => {
      const user = User.create(UsersMother.dto(overrides));
      await repository.save(user);
      return user;
  };
  ```

### 8.3 Del DTO del Mother al payload HTTP

`dto()` incluye `id`, `created_at` y `created_by`, que el servidor gestiona ([§5.2](#52-campos-gestionados-por-el-servidor)). El payload HTTP los quita, salvo que el test los pase a propósito para comprobar que se ignoran:

```javascript
// Campos que el servidor asigna al crear: los que mande el cliente se ignoran.
const SERVER_MANAGED_CREATE_FIELDS = ['id', 'created_at', 'created_by'];

const createPayload = (overrides = {}) => {
    const payload = AnsMother.dto(overrides);
    for (const field of SERVER_MANAGED_CREATE_FIELDS) {
        if (!(field in overrides)) {
            delete payload[field];
        }
    }
    return payload;
};
```

Quitar campos solo sirve si el resto del `dto()` lo acepta el esquema de alta. Cuando el Mother trae campos que el esquema rechaza (`UsersMother.dto()` incluye `updated_by`, `last_seen_at` y `grupo_activo: null`), invierte el enfoque: copia **solo** los campos que admite el esquema y añade los que el Mother no tiene:

```javascript
// Campos de UsersMother.dto() que acepta schemaCreate; el resto lo rechaza o lo gestiona el servidor.
const CREATE_FIELDS = ['login', 'nombres', 'apellido1', 'apellido2', 'email', 'telefono', 'movil', 'rol_id', 'is_active', 'account_type'];

const createPayload = (overrides = {}) => {
    const dto = UsersMother.dto();
    const payload = Object.fromEntries(CREATE_FIELDS.map((field) => [field, dto[field]]));
    return { ...payload, group_ids: [ADMIN_GROUP_ID], ...overrides };
};
```

### 8.4 Estructura de un Mother

```javascript
import { v4 as uuidv4 } from 'uuid';
import Chance from 'chance';
import { <Entidad> } from '../../../src/<contexto>/domain/<Entidad>.js';

export default class <Entidad>Mother {
    static dto(overrides = {}) {
        return {
            id: uuidv4(),
            nombre: 'Entidad Por Defecto',
            status: 1,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
            ...overrides,
        };
    }

    static async create<Entidad>(repository, overrides = {}) {
        const entity = <Entidad>.create(<Entidad>Mother.dto(overrides));
        await repository.save(entity);
        return entity;
    }

    static randomDto() {
        const chance = new Chance();
        return <Entidad>Mother.dto({
            nombre: chance.string({ length: 8, alpha: true }),
            status: chance.integer({ min: 1, max: 2 }),
        });
    }

    static async createRandom<Entidad>(repository) {
        const entity = <Entidad>.create(<Entidad>Mother.randomDto());
        await repository.save(entity);
        return entity;
    }
}
```

---

## 9. Buenas prácticas

1. **Arrange-Act-Assert**, con las tres secciones comentadas.
2. **Nombres** `should <comportamiento> when <condición>`, en inglés como el resto de tests del repo.
3. **Aislamiento:** reset del esquema en el `beforeEach` de cada `describe`; ningún test depende de otro ni comparte estado mutable.
4. **Aserciones fuertes:**
   - Valores exactos (`toBe`, `toEqual`, `toHaveLength`). Nada de `toBeGreaterThanOrEqual(0)`, `toBeLessThanOrEqual(10)` sobre algo que debería ser 10, `expect([201, 400]).toContain(...)` ni `expect(response.status).toBeDefined()`.
   - Nunca un `expect` dentro de un `if`: si la condición no se cumple, el test pasa sin comprobar nada.
5. **Efectos en la base:** después de cada escritura (o de cada escritura rechazada), consulta la base con `repository.table()` y comprueba lo que quedó o lo que no cambió.
6. **Determinismo:** fechas explícitas en lugar de `setTimeout`, nombres fijos en lugar de aleatorios cuando el test depende de ellos y orden explícito en toda paginación.
7. **Constantes en lugar de números mágicos:** `HTTP.CREATED`, `SEEDED_ANS_COUNT`; y del dominio cuando existan (`Types.DAYS.value`).
8. **Errores de `TestHelper`:** sin `try/catch`; el error llega como valor ([§5.1](#51-qué-devuelve-testhelper)).
9. **Mensajes de error:** no se comprueban ([§5.4](#54-los-mensajes-de-error-son-genéricos)).
10. **Sin lógica compleja en los tests:** un bucle para sembrar volumen está bien; ramas condicionales, no.
11. **Comentarios** solo para lo no evidente: por qué una fila sembrada cuenta, por qué una fecha es futura.
12. **Estilo del repo:** 4 espacios, comillas simples (Prettier `@kace/prettier_config`), punto y coma, sin `console.log`. Pasa `npx prettier --check test/*.e2e.mjs` antes de subir.
13. **Sondea antes de afirmar.** El código no siempre dice qué devuelve el API: formas de `metadata.count`, campos que exige el dominio, status de los errores, rutas montadas sin controlador. Ante la duda, escribe un archivo temporal (`test/zz-probe.e2e.mjs`) que haga las peticiones dudosas y vuelque status y cuerpos a un fichero; ejecútalo con `--testMatch '**/zz-probe.e2e.mjs'`, escribe las aserciones con lo que devuelve y bórralo. Un comportamiento que parece un defecto (un 500, un 200 que debería ser 4xx) no se fija en un test: se reporta ([§11](#11-ejemplos-de-referencia)).

---

## 10. Plantilla base

```javascript
import { randomUUID } from 'node:crypto';
import { TestHelper } from '@kace/api-common/tests/helpers/TestHelper.js';
import { Knex<Entidad>Repository } from '@kace/core/src/<contexto>/infrastructure/persistence/Knex<Entidad>Repository.js';
import <Entidad>Mother from '@kace/core/tests/<contexto>/domain/<Entidad>Mother.js';

/**
 * E2E del API REST de <Entidad> según docs/guides/E2E_API_REST_SERVICE_TEST_SPECIFICATION.md.
 *
 * ENTORNO: el test y el Lambda usan SOLO DB_TEST_*. Ejecución: `pnpm run api:e2e` en una
 * terminal y `pnpm run test:e2e` en otra.
 */

const tenant = await TestHelper.getTenant();

const HTTP = { OK: 200, CREATED: 201, BAD_REQUEST: 400, FORBIDDEN: 403, NOT_FOUND: 404 };

// Campos que el servidor asigna al crear: los que mande el cliente se ignoran.
const SERVER_MANAGED_CREATE_FIELDS = ['id', 'created_at', 'created_by'];

// Filas que siembra <archivo de seed> en cada reset.
const SEEDED_<ENTIDAD>_COUNT = 0;

const createPayload = (overrides = {}) => {
    const payload = <Entidad>Mother.dto(overrides);
    for (const field of SERVER_MANAGED_CREATE_FIELDS) {
        if (!(field in overrides)) {
            delete payload[field];
        }
    }
    return payload;
};

// KnexRepository.count() devuelve la fila cruda de COUNT(*), así que el total llega como { count: '2' }.
const totalOf = (response) => Number(response.data.metadata.count.count);

const searchCriteria = (overrides = {}) => ({
    filter: null,
    relationship: null,
    limit: 10,
    offset: 0,
    order: { field: 'created_at', direction: 'desc' },
    ...overrides,
});

describe('<Entidad>Controller E2E tests', () => {
    const repository = new Knex<Entidad>Repository(tenant.buildKnexConfig());
    const baseUrl = 'http://127.0.0.1:<PUERTO>'; // --port del script `api`

    const find<Entidad>By = (where) => repository.table().where(where).first();

    beforeAll(async () => {
        // Guardas de configuración y centinela: §3.4
    });

    afterAll(async () => {
        await repository.destroyConnection();
    });

    // ============================================================
    // CREATE OPERATION
    // ============================================================
    describe('POST / - Create <Entidad>', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should create a <entidad> and persist every field', async () => {
            // Arrange
            const payload = createPayload({ nombre: '<Nombre Único>' });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(HTTP.CREATED);
            expect(await find<Entidad>By({ nombre: '<Nombre Único>' })).toMatchObject({
                // TODO: cada campo del payload
                deleted_at: null,
            });
        });

        it('should replace a client-supplied id with a server-generated one', async () => {
            // Arrange
            const clientId = randomUUID();
            const payload = createPayload({ id: clientId, nombre: '<Nombre Único>' });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(HTTP.CREATED);
            expect(await find<Entidad>By({ id: clientId })).toBeUndefined();
        });

        it('should return 400 when the payload is empty', async () => {
            // Act
            const response = await TestHelper.postRequest(baseUrl, {});

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        // TODO §6.1: campos obligatorios (it.each), tipos, longitudes, formatos,
        // reglas de negocio (sin persistir nada), unicidad y concurrencia.
    });

    // ============================================================
    // READ OPERATION
    // ============================================================
    describe('GET /:id - Read <Entidad> by ID', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should fetch a <entidad> with every field', async () => {
            // Arrange
            const entity = await <Entidad>Mother.create<Entidad>(repository);

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${entity.id.value}`);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            // TODO: toEqual con el cuerpo completo; fechas como instantes (§6.2)
        });

        it('should return 404 when the <entidad> does not exist', async () => {
            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${randomUUID()}`);

            // Assert
            expect(response).toHaveProperty('status', HTTP.NOT_FOUND);
        });

        it('should return 400 when the id is not a UUID', async () => {
            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/invalid-uuid-format`);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });
    });

    // ============================================================
    // UPDATE, DELETE, INDEX, SEARCH: §6.3 – §6.6
    // ERROR HANDLING AND EDGE CASES: §7.1
    // DATA INTEGRITY AND CONSISTENCY: §7.2
    // ============================================================
});
```

---

## 11. Ejemplos de referencia

Cuando una suite destapa defectos del servicio, se listan aquí y en la cabecera del test, y quedan fuera de la suite hasta que se corrijan.

### 11.1 ANS

**Archivo:** `apps/apiv1/kace_cloud_api_ans/test/AnsApiE2E.e2e.mjs`, puerto 60003.

**Entidad ANS (SLA):**

- **Campos:** `nombre`, `intermedio`, `vencido`, tres colores (`color_ans_inicial`, `color_ans_intermedio`, `color_ans_final`), `medicion_ans_id` (`Minutes`, `Hours`, `Days`), `status` (opcional).
- **Validaciones:** `nombre` solo letras y espacios (admite tildes y ñ), entre 3 y 100 caracteres. Colores dentro de la allowlist visual compartida.
- **Reglas de negocio al crear:** `intermedio` < `vencido`; `nombre` único; combinación `intermedio`/`vencido`/`medicion_ans_id` única.
- **Seeds:** un ANS `Basic` (`5/10/Minutes`).

**Cobertura:** 64 casos en los ocho `describe` de [§4.3](#43-organización-del-archivo). Tarda unos 11 minutos contra SAM Local.

**Defectos encontrados y corregidos** (la suite los cubre):

- Un `medicion_ans_id` desconocido devolvía 500, en el alta y en el update: `Types.fromValue()` lanzaba un `Error` genérico y ahora lanza `InvalidArgumentError` (400).
- `AnsUpdater` solo comprobaba `intermedio < vencido` cuando **ambos** venían en el payload: actualizar solo `intermedio: 20` sobre `vencido: 10` guardaba un estado inválido. Ahora completa el campo que falta con el valor guardado.
- `ans-stack.ts` declaraba `/calculate` y `/types` en `setExtraResources`, que nunca se invocaba, y el manifiesto de `@kace/local-server` las listaba sin controlador. Nadie las usaba: se eliminaron.

### 11.2 Users

**Archivo:** `apps/apiv1/kace_cloud_api_users/test/UsersApiE2E.e2e.mjs`, puerto 60051.

**Qué añade respecto a ANS:**

- **Relaciones:** el alta crea una fila en `rel_usuarios_grupos` por grupo y toma el primero como `grupo_activo`; un grupo o un rol inexistente no deja nada persistido. Alta, update y `bulk-update` validan `rol_id` y `grupo_activo` con las mismas reglas (`src/userRelationships.mjs`): deben existir y no estar borrados, y el update solo comprueba los que cambian. La pertenencia al grupo activo solo la exige `update-active-group`: el formulario de administración guarda el usuario antes que sus grupos, y exigirla en el update impediría añadir un grupo y activarlo en el mismo guardado.
- **Obligatorios del dominio:** `is_active` y `login` además de los que exige Joi; el update exige `account_type` ([§5.3](#53-de-error-a-status-http)).
- **Búsqueda con filtro base** y allowlist sin cualificar ([§5.7](#57-búsquedas-esquema-y-allowlist)); `grupos_ids` solo con `UsersSearchAdvanced`.
- **Siete endpoints propios:** `POST /searchByName`, `POST /session/alive`, `GET /session/validate-group`, `POST /update-active-group`, `POST /bulk-update`, `POST /{id}/integration-activity` y `POST /{id}/history`. Los de sesión y `update-active-group` actúan sobre el usuario autenticado ([§6.7](#67-endpoints-adicionales)).
- **Seeds:** 11 usuarios (`20241125105900_usuario_base.js`) y dos grupos (`Administrators Group`, al que pertenecen todos, y `New users`).
- **Mother:** `UsersMother.createUser()` no sirve contra el E2E ([§8.2](#82-cuidados)).

**Cobertura:** 112 casos; tarda unos 18 minutos contra SAM Local.

**Defectos encontrados y corregidos** (la suite los cubre):

- `POST /advance-search` devolvía las filas crudas de `usuarios`, con `session_key`, `refresh_token`, `cognito_id_token` y `cognito_hash_data`: ya no se monta.
- `POST /update-active-group` aceptaba cualquier grupo: ahora exige que exista (404) y que el usuario pertenezca a él (403).
- Respondían 500: borrar un usuario inexistente (ahora 404, igual que uno ya borrado), crear sin `rol_id` (400) y actualizar, uno a uno o con `bulk-update`, con un `rol_id` o `grupo_activo` inexistente (404). La importación CSV de bajas sigue siendo idempotente: un usuario ya borrado no cuenta como error de fila.
- El alta aceptaba un `rol_id` borrado lógicamente: ahora responde 404.
- El total de `GET /` y el de la búsqueda por `grupos_ids` contaban usuarios borrados.
- `POST /session` estaba montada sin controlador: ya no se monta.

---

## 12. Checklist de completitud

### Entorno

- [ ] Scripts `api:e2e` y `test:e2e` en el `package.json` del servicio
- [ ] El template de `cdk.out/` no contiene host, usuario ni esquema de `DB_*`
- [ ] Guardas de configuración y centinela en el `beforeAll`
- [ ] `afterAll` con `repository.destroyConnection()`
- [ ] Archivo `test/<Entidad>ApiE2E.e2e.mjs`, imports directos sin barrels
- [ ] Datos sembrados declarados en una constante con su archivo de seed

### CREATE (`POST /`)

- [ ] Creación correcta verificada en la base
- [ ] El id del cliente se reemplaza
- [ ] Los campos de auditoría del cliente se ignoran
- [ ] Payload vacío → 400
- [ ] Cada campo obligatorio ausente → 400
- [ ] Tipos, longitudes, formatos y catálogos inválidos → 400
- [ ] Caracteres especiales válidos → 201
- [ ] Cada regla de negocio → 400 sin persistir nada
- [ ] Cada restricción de unicidad → 400
- [ ] Creación concurrente de entidades distintas

### READ (`GET /{id}`)

- [ ] Cuerpo completo con `toEqual`
- [ ] Inexistente → 404
- [ ] Id que no es UUID → 400

### UPDATE (`POST /{id}`)

- [ ] Actualización verificada en la base
- [ ] Actualización parcial
- [ ] Campos de auditoría
- [ ] Tipo inválido y campo vacío → 400
- [ ] Valor de dominio inválido → 400 con los datos intactos
- [ ] Regla de negocio en el mismo payload → 400 sin cambios
- [ ] Campos gestionados por el servidor
- [ ] Id que no es UUID → 400
- [ ] Inexistente → contrato actual
- [ ] Campos exigidos aunque la actualización sea parcial (si los hay)

### DELETE (`GET /{id}/delete`)

- [ ] Borrado lógico: la fila queda con `deleted_at` y `deleted_by`
- [ ] Leer un borrado → 404
- [ ] Id que no es UUID → 400
- [ ] Inexistente → contrato actual

### INDEX (`GET /`)

- [ ] Lista con su total, contando los datos sembrados
- [ ] Límite de 10 con el total completo
- [ ] Orden `created_at desc` con fechas explícitas
- [ ] Excluye borrados de `items` y del total

### SEARCH (`POST /search`)

- [ ] Por id cualificado
- [ ] Texto parcial con el operador de la allowlist
- [ ] Varios filtros con `AND`
- [ ] Sin resultados → `[]` y total 0
- [ ] Página exacta con `limit`, `offset` y orden explícito
- [ ] Excluye borrados
- [ ] `limit` inválido y operador inexistente → 400
- [ ] Sin el filtro base (si la política lo declara) → 403
- [ ] Filtro fuera de la allowlist → 403; con `<Módulo>SearchAdvanced` → 200

### Endpoints adicionales

- [ ] Un `describe` por cada ruta montada además del CRUD (`/{id}/history`, `/advance-search`, rutas propias)
- [ ] Cada ruta montada tiene controlador en `handler.mjs`
- [ ] Los endpoints sobre el usuario autenticado comprueban su efecto en él y en nadie más

### Errores y casos límite

- [ ] Ruta inexistente → 403
- [ ] Segmento que no es UUID → 400
- [ ] Texto muy largo → 400
- [ ] Opcional omitido → 201; opcional a `null` → según el esquema
- [ ] SQL injection en el body y en la búsqueda, con la tabla intacta
- [ ] XSS

### Integridad

- [ ] Actualizaciones concurrentes
- [ ] FKs válidas e inexistentes (si las hay)

---

## 13. Problemas conocidos

| Síntoma | Causa | Solución |
|---|---|---|
| `request for 'dotenv' is from a module not been linked` en `resetSchemaAndMigrate` | `migrate.latest()` de knex importa todas las migraciones en paralelo y el cargador ESM de Jest falla al enlazarlas | `TestHelper` las precarga en serie antes de migrar. Si reaparece, comprueba que esa precarga sigue en `TestHelper.js` |
| `Refusing to reset schema "…"` | Falta `ALLOW_SCHEMA_RESET=true` o el esquema no cumple el patrón | [§3.1](#31-variables-de-entorno) |
| El centinela falla o todo devuelve 404 | El Lambda lee otra base (arrancado con `pnpm run api` y `APPS_ENVIRONMENT` distinto de `local`) | Arráncalo con `pnpm run api:e2e` |
| SAM no encuentra `cdk.out/…template.json` | `APPS_SERVICE_NAME` no produce el nombre que espera el script `api` | Ajusta `APPS_SERVICE_NAME` en `api:e2e` |
| `ECONNREFUSED 127.0.0.1:<puerto>` (status `undefined`) | SAM Local no está levantado | `pnpm run api:e2e` |
| El Lambda no conecta con Postgres | `DB_TEST_HOST` no es alcanzable desde la red Docker de SAM | Usa el host o IP del contenedor de Postgres en `kace_cloud_main_global-network` y el puerto interno |
| Todas las peticiones devuelven 400 | El `sub` del usuario de Cognito no es el `login` de ningún usuario sembrado | Revisa `TEST_APP_USER` y el seed `20241125105900_usuario_base.js` |
| 403 en `POST /search` | Filtro fuera de la allowlist, o falta el filtro base | [§5.7](#57-búsquedas-esquema-y-allowlist) |
| `relation "roles" does not exist` (u otra tabla) al sembrar | El Mother crea filas padre con SQL sin esquema | Construye con `dto()` y guarda con el repositorio ([§8.2](#82-cuidados)) |
| Todos los updates devuelven 400 | El esquema de update exige un campo que el payload parcial no lleva (users: `account_type`) | Helper `updatePayload()` ([§5.3](#53-de-error-a-status-http)) |
| Todas las peticiones de un test devuelven 400 tras un arrange | El test desactivó o borró al usuario autenticado | No lo toques ([§6.7](#67-endpoints-adicionales)) |
| Una ruta montada devuelve 404 | `handler.mjs` no la asigna a ningún controlador | [§6.7](#67-endpoints-adicionales) |
| Tests que expiran de forma intermitente | SAM crea un contenedor por invocación y a veces tarda | `--testTimeout=60000` en `test:e2e` |
| `Exceeded timeout of 60000 ms for a hook` en el `beforeEach` del reset, seguido de `relation "knex_migrations" does not exist` | Otra suite carga el mismo Postgres (los tests de `@kace/core` clonan una base por archivo y fuerzan checkpoints con `fsync` largos) | No las ejecutes a la vez. El segundo error es consecuencia: el reset que expiró sigue vivo y choca con el siguiente |
| Un cambio en `src/` no se refleja en el E2E | SAM sirve el código empaquetado en `cdk.out` al sintetizar | Para y relanza `pnpm run api:e2e` |
| Lista "vacía" con un elemento de más | Datos sembrados | [§5.5](#55-datos-sembrados) |

---

## 14. Recursos

- Ejemplos de referencia: `apps/apiv1/kace_cloud_api_ans/test/AnsApiE2E.e2e.mjs` y `apps/apiv1/kace_cloud_api_users/test/UsersApiE2E.e2e.mjs`
- `TestHelper`: `packages/kace_cloud_api_common/tests/helpers/TestHelper.js`
- Respuestas y saneamiento de errores: `packages/kace_cloud_api_common/src/http_responses/Response.js`
- Campos gestionados por el servidor: `packages/kace_cloud_api_common/src/security/ObjectIdentityAuthorization.js`
- Esquema y allowlist de búsqueda: `packages/kace_cloud_api_common/src/validation/schemas/SearchSchema.js` y `packages/kace_cloud_api_common/src/search-authorization/SearchPolicyRegistry.js`
- Seeds: `packages/kace_cloud_database/seeds/`
- Guía B, Estilo y convenciones: [style-and-conventions.md](style-and-conventions.md)
- Guía C, Decisiones de tooling: [tooling-decisions.md](tooling-decisions.md)
- [Jest](https://jestjs.io/docs/getting-started) · [AWS SAM Local](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-local-start-api.html) · [Knex](https://knexjs.org/guide/query-builder.html) · [Chance.js](https://chancejs.com/)

---

**Documento creado:** 2026-01-28
**Versión:** 2.1 (2026-10-06)

**Historial:**

- **2.1:** validada con un segundo servicio, users. Documenta que `metadata.count` y otros campos cambian de forma entre servicios y endpoints, el filtro base de las políticas de búsqueda y su allowlist sin cualificar, los campos obligatorios del dominio y de los updates parciales, los endpoints sobre el usuario autenticado, las rutas montadas sin controlador, los Mothers que no funcionan sin `search_path`, el payload construido con los campos del esquema y el sondeo previo a las aserciones, las rutas de un segmento que captura `/{id}`, el riesgo de la implementación por defecto de `advance-search` y que el update solo valida las relaciones que cambian. Añade users como segundo ejemplo de referencia.
- **2.0:** validada implementando el E2E de ANS. Añade la preparación del entorno (`api:e2e`, `test:e2e`, guardas), el contrato real del API (campos gestionados por el servidor, mapeo de errores, mensajes genéricos, `metadata.count`, seeds, allowlist de búsqueda) y los problemas conocidos. Corrige los ejemplos (imports directos, `repository.table()`, `destroyConnection()`, estilo del repo, aserciones fuertes), elimina los tests imposibles o duplicados y el ejemplo ficticio de Clasificaciones, y renombra el documento (antes `docs/testing/E2E_TEST_SPECIFICATION.md`).
- **1.0:** versión inicial.
