# Códigos de error públicos: una fuente de verdad

**Fecha:** 2026-08-13  
**Rama:** `feat/error-codes-ssot` (desde `origin/develop`)  
**PR:** una, atómica (paquete + remap + todos los imports)  
**Estado:** Pendiente de review del usuario antes del plan de implementación

Hoy el contrato público vive duplicado: `packages/kace_cloud_core/src/shared/errors/ErrorCodes.js` y `apps/kace-saas/src/errors/publicErrorCodes.js`. Los valores son hex `0xCCNNNN` (letras A–F y huecos). Este diseño mueve el catálogo a `@kace/error-codes`, lo parte por categoría, y republica cada código como `0x` + 6 dígitos **decimales** consecutivos por categoría.

## Quick path

1. Crear `packages/kace_cloud_error_codes` (`@kace/error-codes`) con TDD: catálogo por categoría + helpers.
2. Remapear valores según la tabla de este doc. Los **nombres** no cambian.
3. Cortar todos los imports a `@kace/error-codes`. Borrar los dos diccionarios viejos. Sin re-export en `@kace/core`.
4. Hecho cuando: tests del paquete verdes; `rg` no encuentra `ErrorCodes.js` ni `publicErrorCodes.js` como origen; tests de consumidores afectados verdes.

## Decisiones

| Tema | Decisión |
|------|----------|
| Forma canónica | `0x` + 6 dígitos decimales. Ejemplo: `0x030010`. El `0x` es prefijo de contrato, no encoding hex. |
| Patrón | `/^0x\d{6}$/` (`x` minúscula, solo dígitos `0-9`) |
| Consecutivo | Por categoría, sin reciclar un valor ya publicado. Los decimales publicados se quedan. Los que tenían letra A–F pasan al siguiente sufijo libre. HTTP conserva huecos históricos. |
| Prefijos con letra | `0x0C` → `12` (files), `0x0F` → `15` (tenant) |
| Corte | Duro para formas hex (`0x03000A`, `0x0C0001`, …). Sin alias, sin `legacy_code`, sin dual-write. Un valor publicado no cambia de significado. |
| Superficie del paquete | Constantes + mapa + helpers. Copy i18n se queda en el frontal |
| Forma del paquete | Un archivo por categoría **con códigos hoy** + `helpers.js` |
| Imports | Todos los consumidores importan `@kace/error-codes`. Sin facade |
| i18n | Locales FE siguen keyed por **nombre**. El paquete no conoce la ruta i18n. `getPublicErrorCodeI18nKey(code, namespace)` exige `namespace` (sin default). El frontal pasa hoy `'app.errors.public'`. |
| Rama | `feat/error-codes-ssot` desde `origin/develop` |

## Fuera de alcance

- Clases `BaseError` / `AuthFailError` / `Response` (solo cambian el import del código)
- Textos i18n nuevos o cambios de copy
- Mapa de compatibilidad con hex viejo (`0x03000A`, `0x0C0001`, …)
- Archivos vacíos para categorías reservadas
- Codegen / JSON como fuente
- PRs apiladas o landing en `release/*`
- e2e nuevos o tests de Knex

## Arquitectura

```text
@kace/error-codes
  categories.js          prefijos 01–15 (reservados documentados)
  catalog/*.js           constantes de una categoría
  catalog.js             une, índices, throw si nombre/código duplicado
  helpers.js             normalize, find, getName, isKnown, getI18nKey
  index.js               único entry público
        │
        ├── @kace/core
        ├── @kace/api-common
        ├── apps/apiv1/* (los que hoy importan ErrorCodes)
        └── apps/kace-saas  (locales siguen en el frontal)
```

`pnpm-workspace.yaml` ya incluye `packages/**`. No hace falta tocarlo.

## Paquete

### Ubicación y tooling

```text
packages/kace_cloud_error_codes/
├── package.json
├── index.js
├── jest.config.js
├── src/
│   ├── categories.js
│   ├── catalog.js
│   ├── helpers.js
│   └── catalog/
│       ├── general.js          # 01
│       ├── validation.js       # 03
│       ├── database.js         # 04
│       ├── http.js             # 05
│       ├── auth.js             # 07
│       ├── authorization.js    # 08
│       ├── files.js            # 12
│       └── tenant.js           # 15
└── tests/
    ├── catalog.test.js
    └── helpers.test.js
```

- `name`: `@kace/error-codes`
- `version`: `1.24.3` (alineada con paquetes hermanos)
- `type`: `module`
- `main`: `index.js`
- `dependencies`: ninguna
- Scripts / Jest / Prettier: mismo patrón que `@kace/file-extensions`
- No crear módulos de categoría sin códigos (`02`, `06`, `09`–`11`, `13`, `14`)

### Prefijos (`categories.js`)

| Prefijo | Categoría | Archivo |
|---------|-----------|---------|
| `01` | General / core | `general.js` |
| `02` | Configuration | reservado |
| `03` | Validation | `validation.js` |
| `04` | Database | `database.js` |
| `05` | Network / HTTP | `http.js` |
| `06` | Integrations | reservado |
| `07` | Authentication | `auth.js` |
| `08` | Authorization | `authorization.js` |
| `09` | Crypto | reservado |
| `10` | Cache (antes `0A`) | reservado |
| `11` | Queues (antes `0B`) | reservado |
| `12` | Files (antes `0C`) | `files.js` |
| `13` | Observability (antes `0D`) | reservado |
| `14` | Feature flags (antes `0E`) | reservado |
| `15` | Internal / tenant (antes `0F`) | `tenant.js` |

### Archivo de categoría

Literales string, no plantillas en runtime:

```js
export const VALIDATION_ERROR = '0x030001';
export const BOARD_BULK_ACTIONS_INCOMPATIBLE = '0x030029';
```

### Ensamblador (`catalog.js`)

- Importa todos los módulos de `catalog/`
- Construye `PUBLIC_ERROR_CODES` (frozen), `PUBLIC_ERROR_CODE_ENTRIES`, `PUBLIC_ERROR_CODE_NAMES_BY_CODE`
- Al cargar: `throw` si hay nombre duplicado o código duplicado
- No valida consecutivo ni formato en runtime (eso es de tests)

### Helpers (`helpers.js`)

Misma semántica que el frontal actual, otra forma:

| Función | Comportamiento |
|---------|----------------|
| `normalizePublicErrorCode(code)` | Si `typeof code === 'string'`, trim, y cumple `/^0x\d{6}$/` → ese string. Si no → `undefined` |
| `findPublicErrorCode(...codes)` | Primer argumento que **normaliza** (no exige estar en el catálogo) |
| `getPublicErrorCodeName(code)` | Nombre si el normalizado está en el catálogo; si no `undefined` |
| `isKnownPublicErrorCode(code)` | `Boolean(getPublicErrorCodeName(code))` |
| `getPublicErrorCodeI18nKey(code, namespace)` | Si el código es conocido y `namespace` es string no vacío → `${namespace}.${name}`. Si falta namespace, está vacío, o el código no es conocido → `undefined`. Sin default: el paquete no embebe `app.errors.public`. |

Rechazos explícitos de `normalize` (→ `undefined`):

- `0x03000A` (letra)
- `0x03000f` (letra / hex case)
- `0X030001` (`X` mayúscula)
- `030001` (sin prefijo)
- `0x0C0001` (letra en prefijo)
- no-string, vacío, otra longitud

Los helpers no lanzan.

### Barrel (`index.js`)

Único entry. Exporta:

- Todas las constantes con nombre
- `PUBLIC_ERROR_CODES`, `PUBLIC_ERROR_CODE_ENTRIES`, `PUBLIC_ERROR_CODE_NAMES_BY_CODE`
- `PUBLIC_ERROR_CODE_PATTERN` (`/^0x\d{6}$/`)
- Los cinco helpers

Nadie importa `catalog/auth.js` a pelo. `categories.js` no es API pública.

## Remap

**Algoritmo:** conservar todo valor ya publicado que cumpla `/^0x\d{6}$/`. Los códigos con letra A–F reciben el siguiente sufijo decimal libre de su categoría (por encima del máximo publicado). Los nombres no se tocan. No se reutiliza un valor publicado con otro significado. Los huecos HTTP (`0002`, `0003`, `0006`, `0007`) quedan sin asignar.

**Siguiente código nuevo:** último sufijo usado de su categoría + 1 (`0x030044`, `0x050010`, `0x070009`, …). Lo fija el test de catálogo.

### General `01`

| Nombre | Hoy | Nuevo |
|--------|-----|-------|
| `GENERAL_INTERNAL_ERROR` | `0x010001` | `0x010001` |

### Validation `03` (40 códigos, `0x030001`–`0x030040`)

| Nombre | Hoy | Nuevo |
|--------|-----|-------|
| `VALIDATION_ERROR` | `0x030001` | `0x030001` |
| `CASE_BULK_TRANSITION_MIXED_CURRENT_TRANSITION` | `0x030002` | `0x030002` |
| `CASE_TRANSITION_NOT_ALLOWED` | `0x030003` | `0x030003` |
| `CASE_TRANSITION_CONDITIONS_NOT_MET` | `0x030004` | `0x030004` |
| `CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE` | `0x030005` | `0x030005` |
| `BOARD_REQUIRES_ACTIVE_GROUP` | `0x030006` | `0x030006` |
| `BOARD_EXPORT_NO_RECORDS` | `0x030007` | `0x030007` |
| `AUXILIARY_RECORD_HAS_MAIN_ENTITY_DEPENDENCY` | `0x030008` | `0x030008` |
| `CLASSIFICATION_GROUP_RELATION_NOT_FOUND` | `0x030009` | `0x030009` |
| `BROKER_ADAPTER_VHOST_REQUIRED` | `0x030010` | `0x030010` |
| `BROKER_MAPPER_QUEUE_REQUIRED` | `0x030011` | `0x030011` |
| `USER_CREATE_GROUPS_REQUIRED` | `0x030012` | `0x030012` |
| `USER_CREATE_ACTIVE_GROUP_NOT_IN_MEMBERSHIPS` | `0x030013` | `0x030013` |
| `USER_CREATE_GROUPS_NOT_FOUND` | `0x030014` | `0x030014` |
| `MAIL_ACCOUNT_HOST_NOT_ALLOWED` | `0x030015` | `0x030015` |
| `CSV_EXPORT_VIEW_NOT_FOUND` | `0x030016` | `0x030016` |
| `APPOINTMENT_TIME_SLOT_ALREADY_EXISTS` | `0x030017` | `0x030017` |
| `APPOINTMENT_TIME_SLOT_OVERLAPS_EXISTING_SLOT` | `0x030018` | `0x030018` |
| `LITERAL_ENTITY_NOT_FOUND` | `0x030019` | `0x030019` |
| `APPOINTMENT_TIME_SLOT_ALREADY_DELETED` | `0x030020` | `0x030020` |
| `AUX_EXPORT_NO_RECORDS` | `0x030021` | `0x030021` |
| `GROUP_CREATE_USERS_NOT_FOUND` | `0x030022` | `0x030022` |
| `CLASSIFICATION_CREATE_TEMPLATES_NOT_FOUND` | `0x030023` | `0x030023` |
| `SQL_BLACKLIST_WORD_DETECTED` | `0x030024` | `0x030024` |
| `TEMPLATE_INVALID_TYPE` | `0x030025` | `0x030025` |
| `TEMPLATE_ATTACHMENT_EXTENSION_NOT_ALLOWED` | `0x030026` | `0x030026` |
| `GROUP_HAS_ACTIVE_USERS` | `0x030027` | `0x030027` |
| `BROKER_MAPPER_VALIDATION_FAILED` | `0x030028` | `0x030028` |
| `BOARD_BULK_ACTIONS_INCOMPATIBLE` | `0x03000A` | `0x030029` |
| `RESOURCE_ALREADY_EXISTS` | `0x03000B` | `0x030030` |
| `INTERACTION_EMAIL_ALREADY_LINKED` | `0x03000C` | `0x030031` |
| `CASE_DESCRIPTION_EDIT_LOCKED` | `0x03000D` | `0x030032` |
| `CHANNEL_HUB_REGISTRATION_FLOW_INVALID` | `0x03000E` | `0x030033` |
| `WORKSPACE_CHANNEL_HUB_ACCOUNT_REQUIRED` | `0x03000F` | `0x030034` |
| `LITERAL_NAME_ALREADY_EXISTS` | `0x03001A` | `0x030035` |
| `LITERAL_TYPE_NOT_FOUND` | `0x03001B` | `0x030036` |
| `APPOINTMENT_TIME_SLOT_INVALID_TIME_RANGE` | `0x03001C` | `0x030037` |
| `APPOINTMENT_TIME_SLOT_EXCEEDS_AGENDA_DAILY_LIMIT` | `0x03001D` | `0x030038` |
| `APPOINTMENT_TIME_SLOT_AGENDA_NOT_FOUND` | `0x03001E` | `0x030039` |
| `APPOINTMENT_TIME_SLOT_NOT_FOUND` | `0x03001F` | `0x030040` |

### Database `04`

| Nombre | Hoy | Nuevo |
|--------|-----|-------|
| `DATABASE_ERROR` | `0x040001` | `0x040001` |

### HTTP `05` (huecos históricos se conservan)

| Nombre | Hoy | Nuevo |
|--------|-----|-------|
| `BAD_REQUEST_ERROR` | `0x050001` | `0x050001` |
| `NOT_FOUND_ERROR` | `0x050004` | `0x050004` |
| `METHOD_NOT_ALLOWED_ERROR` | `0x050005` | `0x050005` |
| `REQUEST_TIMEOUT_ERROR` | `0x050008` | `0x050008` |
| `CONFLICT_ERROR` | `0x050009` | `0x050009` |

### Auth `07`

| Nombre | Hoy | Nuevo |
|--------|-----|-------|
| `AUTH_FINGERPRINT_MISMATCH` | `0x070001` | `0x070001` |
| `AUTH_GET_TOKEN_CLAIMS` | `0x070002` | `0x070002` |
| `AUTH_USER_NOT_FOUND` | `0x070003` | `0x070003` |
| `AUTH_USER_INACTIVE` | `0x070004` | `0x070004` |
| `AUTH_SESSION_KEY_MISMATCH` | `0x070005` | `0x070005` |
| `AUTH_NOT_USER_AUTHENTICATED` | `0x070006` | `0x070006` |
| `AUTH_SESSION_ACTIVE_ON_ANOTHER_DEVICE` | `0x070007` | `0x070007` |
| `AUTH_SESSION_COOKIE_STALE` | `0x070008` | `0x070008` |

### Authorization `08`

| Nombre | Hoy | Nuevo |
|--------|-----|-------|
| `AUTHORIZATION_ERROR` | `0x080001` | `0x080001` |

### Files `12`

| Nombre | Hoy | Nuevo |
|--------|-----|-------|
| `HELP_ATTACHMENT_FILENAME_REJECTED` | `0x0C0001` | `0x120001` |

### Tenant `15`

| Nombre | Hoy | Nuevo |
|--------|-----|-------|
| `TENANT_CONTEXT_ERROR` | `0x0F0001` | `0x150001` |

## Flujo

1. Dominio/aplicación importa el constante de `@kace/error-codes` y lo pone en el error / `publicErrorCode`.
2. `Response` lo publica en el body como el string canónico.
3. El frontal: `normalize` → `getName` / `getI18nKey(code, 'app.errors.public')` → copy en `en.json` / `es.json`. Si la ruta i18n cambia, solo se toca el caller FE.
4. Código desconocido o hex viejo: helpers → `undefined`; `getTranslatedError` usa el fallback actual (mensaje genérico / legacy por texto). Sin alias.

## Cutover de imports

Borrar:

- `packages/kace_cloud_core/src/shared/errors/ErrorCodes.js`
- `packages/kace_cloud_core/tests/shared/errors/ErrorCodes.test.js`
- `apps/kace-saas/src/errors/publicErrorCodes.js`
- `apps/kace-saas/src/errors/publicErrorCodes.test.js` (espejo + scrape de core)

Sustituir el test espejo por un test delgado `apps/kace-saas/src/errors/publicErrorCodeI18n.test.js` que solo afirma copy i18n (p. ej. `BROKER_MAPPER_VALIDATION_FAILED` en `en`/`es`). No scrapea el paquete ni core.

Añadir `"@kace/error-codes": "workspace:*"` en:

- `packages/kace_cloud_core`
- `packages/kace_cloud_api_common`
- `apps/kace-saas`
- cada app `apps/apiv1/*` que hoy importa `@kace/core/src/shared/errors/ErrorCodes.js`

Reemplazar:

| De | A |
|----|---|
| `@kace/core/src/shared/errors/ErrorCodes.js` | `@kace/error-codes` |
| rutas relativas a `ErrorCodes.js` / `ErrorCodes` | `@kace/error-codes` |
| `@/errors/publicErrorCodes` | `@kace/error-codes` |
| `jest.unstable_mockModule('…/ErrorCodes.js')` | `jest.unstable_mockModule('@kace/error-codes')` |

Vite (`apps/kace-saas/vite.config.js`): `test.server.deps.inline` incluye `@kace/error-codes` junto a `@kace/file-extensions`.

No re-exportar el catálogo desde `@kace/core`.

FE: el test delgado de copy vive en `publicErrorCodeI18n.test.js`. No se recrea el test espejo.

## Tests (TDD)

Orden:

1. Tests del paquete (rojo): formato, unicidad, consecutivo, helpers, valores remapados, nombres actuales presentes.
2. Implementar catálogo + helpers hasta verde.
3. Cutover de imports + actualizar literales viejos en tests de consumidores.
4. Borrar diccionarios viejos. Consumidores afectados en verde.

Invariantes del paquete:

- Todos los códigos cumplen `/^0x\d{6}$/`
- Nombres y valores únicos entre archivos
- Por categoría, sufijos únicos; validation `03` es `0001`…`0040`; HTTP `05` conserva `[0001, 0004, 0005, 0008, 0009]`
- Se exportan todos los nombres de la tabla de remap
- Valores clavados: `BOARD_BULK_ACTIONS_INCOMPATIBLE = 0x030029`, `BROKER_ADAPTER_VHOST_REQUIRED = 0x030010`, `NOT_FOUND_ERROR = 0x050004`, `HELP_ATTACHMENT_FILENAME_REJECTED = 0x120001`, `TENANT_CONTEXT_ERROR = 0x150001`
- Helpers: aceptan `0x030001`; rechazan los casos de la lista de `normalize`
- Duplicado al ensamblar → lanza

No hay e2e nuevo.

## Checklist

- [ ] `@kace/error-codes` existe y es la única fuente de constantes y helpers de catálogo
- [ ] Cada código de la tabla se publica con el valor **Nuevo**
- [ ] No queda import a `ErrorCodes.js` ni a `publicErrorCodes.js`
- [ ] No hay re-export del catálogo en `@kace/core`
- [ ] Locales FE siguen keyed por nombre; test delgado de copy se conserva
- [ ] Hex viejo no se traduce
- [ ] Tests del paquete + consumidores afectados verdes
- [ ] Una PR desde `feat/error-codes-ssot` → `develop`

## Next step

Review de esta spec. Si no hay cambios, plan de implementación (writing-plans) y luego TDD en la misma rama.
