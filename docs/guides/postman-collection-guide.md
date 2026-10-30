# Guía para crear la colección de Postman de un microservicio

Cómo armar la colección de Postman de un servicio de `apps/apiv1/`. Hay dos colecciones de referencia:

- [ANS](../../apps/apiv1/kace_cloud_api_ans/postman/kace_cloud_api_ans.postman_collection.json): un CRUD sin dependencias, con rutas publicadas sin implementar.
- [Users](../../apps/apiv1/kace_cloud_api_users/postman/kace_cloud_api_users.postman_collection.json): un alta que necesita entidades existentes, endpoints propios y endpoints que actúan sobre el usuario autenticado.

Lo más rápido es copiar la que más se parezca a tu servicio y adaptar lo que esta guía marca como específico.

Documento hermano: [Especificación de tests E2E](E2E_API_REST_SERVICE_TEST_SPECIFICATION.md), que describe el mismo contrato desde los tests.

---

## 1. Ubicación y formato

- Un archivo por servicio: `apps/apiv1/<servicio>/postman/<servicio>.postman_collection.json`.
- Formato **Postman Collection v2.1**.
- Nombre de la colección: `KACE · <Servicio> API (<servicio>)`.
- Sin archivos de entorno: toda la configuración vive en variables de colección (§3).

## 2. El contrato sale del código

Antes de escribir una petición, lee estos archivos. Cada uno responde una pregunta:

| Archivo | Qué te dice |
| :--- | :--- |
| `lib/<servicio>-stack.ts` | El base path (`setDefaultOptions('<id>')` → `/<id>`) y las rutas extra (`setExtraResources`). Algunos stacks montan las rutas a mano y omiten alguna de las de por defecto (users no monta `advance-search`): cuenta solo las que se montan. |
| `packages/kace_cloud_aws_infra/src/KApiStack.ts` (`setDefaultResources`) | Las 8 rutas que publica todo servicio: `GET /`, `POST /`, `GET /{id}`, `POST /{id}`, `GET /{id}/delete`, `POST /search`, `POST /{id}/history`, `POST /advance-search`. |
| `src/handler.mjs` | Qué controlador atiende cada ruta propia. |
| `packages/kace_cloud_api_common/src/controllers/BaseController.js` (`#resourceAllowed`, `#actions`) | Qué rutas llegan de verdad a un `action*`. Una ruta publicada que no está en esa lista responde 404 con `TENANT_CONTEXT_ERROR`. |
| `src/controller*.mjs` | El permiso de cada acción (`hasPermission('administrador', '<módulo>', '<Permiso>')`) y el status de éxito. |
| `src/schemas.mjs` | Campos obligatorios, tipos, patrones y campos que asigna el servidor. |
| Casos de uso y value objects en `@kace/core` | Reglas que Joi no ve: unicidad, invariantes entre campos, enumerados. |
| `packages/kace_cloud_api_common/src/search-authorization/SearchPolicyRegistry.js` | Los filtros permitidos en `POST /search` (clave `<id>.search`). |
| `test/*.e2e.mjs` | Status ya comprobados contra un Lambda real. |

Si el código y la intuición no coinciden, manda el código: la colección documenta lo que el servicio hace hoy.

## 3. Variables: todas de colección

Configurar la colección es rellenar su pestaña **Variables** una sola vez. No uses entornos ni valores fijos dentro de las peticiones.

| Variable | Valor | Notas |
| :--- | :--- | :--- |
| `baseUrl` | `https://<AWS_APIGATEWAY_DOMAIN_NAME>` | Sin barra final. Es el mismo para todos los servicios. |
| `tenantId` | `VITE_TENANT_ID` del `.env` | Cabecera `X-Tenant-Id`. |
| `cognitoRegion` | Región del user pool del tenant | |
| `cognitoClientId` | App client del user pool del tenant | |
| `username`, `password` | Usuario de Cognito | Permiten renovar el token automáticamente. |
| `idToken` | Lo gestiona el script de colección | Las cuentas SSO lo pegan a mano. |
| `clientFingerprint` | Vacío | Solo cuentas Active Directory. |
| `<entidad>Id`, … | Vacío | Los rellenan los scripts del flujo CRUD. |

- `password` e `idToken` van solo en **Current value**. El **Initial value** se exporta, se sincroniza con el workspace y acaba en git.
- Usa estos mismos nombres en todos los servicios: quien ya configuró una colección configura la siguiente copiando valores.

## 4. Autenticación

El Lambda verifica el **IdToken** de Cognito (no el access token) y lo lee de `Authorization` **sin** el prefijo `Bearer`.

- **Autorización de la colección**: tipo *API Key*, key `Authorization`, value `{{idToken}}`, *Add to* `Header`.
- **Script *pre-request* de la colección**: renueva el token con `InitiateAuth` (`USER_PASSWORD_AUTH`) cuando falta o le queda menos de un minuto. Cópialo tal cual de una colección de referencia: no tiene nada específico del servicio.
- **Script *test* de la colección**: escribe en la consola de Postman el cuerpo de cada error. También es genérico.
- **Carpeta `0. Autenticación`**: la petición de login directa a Cognito, con auth `noauth`, para comprobar las credenciales, y las peticiones de preparación si el servicio las necesita (§6.1).
- Las cuentas Active Directory necesitan además `X-Client-Fingerprint` y la cookie `session_key` en el cookie jar de Postman.

## 5. Peticiones

- **URL**: `{{baseUrl}}/<basePath>/...`, con el id como path variable `:id` y valor `{{<entidad>Id}}`. Ejemplo: `{{baseUrl}}/ans/:id`. No uses otros placeholders: el importador de `packages/kace_cloud_perf` solo sabe sustituir `:id`.
- **Métodos**: solo `GET` y `POST`. Actualizar es `POST /{id}` y borrar es `GET /{id}/delete`.
- **Cabeceras** explícitas en cada petición: `X-Tenant-Id: {{tenantId}}`, `X-Client-Fingerprint: {{clientFingerprint}}` y, en los `POST`, `Content-Type: application/json`. Explícitas y no inyectadas por script, para que se vean en la pestaña *Headers* y una petición pueda omitirlas al probar el error.
- **Descripción**: en cada petición, el permiso que exige y las reglas de validación que no sean evidentes.
- **SAM Local** no aplica el base path, así que la colección apunta a un entorno desplegado.

## 6. Estructura de carpetas

| Carpeta | Contenido |
| :--- | :--- |
| `0. Autenticación` | Login en Cognito y, si hacen falta, las peticiones de preparación (§6.1). |
| `1. Flujo CRUD` | Crear → obtener el id → listar → leer → actualizar → leer actualizado → borrar → leer borrado (404). Se ejecuta de principio a fin con el Runner. |
| `2. Búsqueda` | Un ejemplo por tipo de filtro de la allowlist, un grupo `OR`, paginación y orden. |
| `3. Validaciones y errores` | Un caso por regla relevante, con el status real (§7.1). |
| `4. Endpoints propios` | Rutas del `handler.mjs` que no son CRUD, si las hay (§6.2). |
| `5. Rutas que no llegan a un controlador` | Rutas publicadas sin implementar o no expuestas, si las hay (§6.3). |

La numeración es fija aunque falte alguna carpeta: ANS no tiene endpoints propios, así que pasa de la 3 a la 5.

### 6.1 Peticiones de preparación

Si el alta exige entidades que ya existen, no pidas sus ids a mano: añade en `0. Autenticación` una petición que los obtenga y los guarde en variables de colección. En users, el alta necesita un `rol_id` y unos `group_ids` válidos; «Usuario autenticado» busca al usuario del token (su `login` es el `sub` del IdToken) y guarda su id, su rol y su grupo para reutilizarlos. Las carpetas que dependen de esa petición lo indican en su descripción.

### 6.2 Flujo CRUD y endpoints propios

- El *pre-request* del alta genera datos únicos (un nombre aleatorio que cumpla el patrón de Joi y valores que no choquen con las restricciones de unicidad) y los guarda en variables de colección.
- Si el alta no devuelve el id (en ANS responde 201 sin cuerpo), el paso siguiente busca por el campo único y guarda `<entidad>Id`.
- Cada paso usa lo que guardó el anterior. Ningún paso depende de datos sembrados a mano.
- Las carpetas 1 y 4 crean y borran sus propios datos. La 4 empieza creando una entidad de apoyo y termina borrándola, para poder ejecutarse sola.
- Las altas de los casos negativos generan sus datos en variables propias (`tmpLogin`, `tmpNombres`, …) para no pisar las del flujo CRUD.
- Algunos endpoints no reciben id y actúan sobre el usuario autenticado (en users: `/session/alive`, `/session/validate-group`, `/update-active-group`). Describe en la petición qué cambian y usa valores que no alteren su estado, por ejemplo su grupo activo actual.

### 6.3 Rutas que no llegan a un controlador

Van en la carpeta `5. Rutas que no llegan a un controlador`, y los tests fijan la respuesta actual. Son de dos tipos; si el servicio solo tiene uno, la carpeta puede llevar su nombre, como `5. Rutas no expuestas` en users.

- **Publicadas sin implementar**: el stack las monta, pero ni `BaseController` ni el handler las atienden. Responden 404 con `TENANT_CONTEXT_ERROR`, o 500 «not implemented» en el caso de `/{id}/history`. En ANS: `/{id}/history`.
- **No expuestas a propósito**: rutas que el stack dejó de montar. En users: `/advance-search` y `/session`; en ANS: `/types` y `/calculate`. Una ruta de un solo segmento sin recurso propio la captura `/{id}` con el mismo método (`GET /types` cae en la lectura y `POST /calculate` en la actualización), que responde 400 por id inválido. Un recurso que existe sin métodos responde 403 en API Gateway y 400 en SAM Local: acepta ambos con `oneOf`.

## 7. Tests

Cada petición lleva al menos el test de status. Añade aserciones sobre el cuerpo solo cuando aporten algo.

- **Éxito**: `{ message, data, metadata? }`. Los listados traen `data.items` y `metadata.count`, cuya forma cambia entre servicios y endpoints: la fila cruda del conteo (`{ "count": "N" }`), un string (`"N"`) o un número. Normalízalo en el test en lugar de suponer una forma.
- **Errores**: mensaje genérico y `data.code`. Comprueba que `data.code` existe; no compares el mensaje.
- **Status según el origen del error** (fuente: `packages/kace_cloud_api_common/src/http_responses/Response.js`):

| Origen | Status |
| :--- | :--- |
| Validación Joi | 400 |
| `ValidationFailError` | 400 |
| Entidad no encontrada al leer | 404 |
| Entidad no encontrada al actualizar o borrar | Depende del caso de uso: 400 si lanza `ValidationFailError` (ANS), 404 si lanza un error con `statusCode` 404 (users) |
| Sin permiso, o filtro fuera de la allowlist | 403 |
| Login fallido en el Lambda | 400 (401 si el authorizer de API Gateway está activo) |
| Sin `X-Tenant-Id` o tenant desconocido | 404 |
| `Error` genérico | 500 |

- **Defectos**: si el status actual es un error del servicio, el test fija el comportamiento actual y el nombre lo marca con ⚠️ y lo esperado, por ejemplo `Crear con medición inválida (500 ⚠️)`. Abre la incidencia; cuando se corrija, se actualiza el test.

### 7.1 Casos negativos seguros

Un caso negativo no debe poder modificar datos reales si la validación que prueba fallara:

- **Sobre un id, en endpoints que escriben**: usa el UUID inexistente `00000000-0000-4000-8000-000000000000`, nunca el de una entidad real ni el del usuario autenticado. Los de solo lectura (`/{id}/history`) pueden usar un id real. El status depende del orden del `action*`: si valida con Joi antes de buscar la entidad, sale el 400 de la validación; si busca antes, sale 404. Léelo en el controlador antes de fijar el test.
- **Sobre el usuario autenticado** (endpoints sin id): solo payloads que Joi rechaza. Para probar campos desconocidos usa uno inocuo (`campo_desconocido`), nunca un campo real como `is_active`.
- **Altas**: si la validación fallara, crearían un registro. Usa datos claramente de prueba (`postman.<sufijo>`) para poder localizarlos y borrarlos.

## 8. Antes del commit

1. Importa el archivo en Postman, rellena las variables y ejecuta la colección completa con el Runner contra desarrollo. Todos los tests deben quedar en verde, incluidos los marcados con ⚠️.
2. Comprueba que ningún *Initial value* lleva credenciales ni tokens.
3. Si editaste en Postman, exporta como *Collection v2.1* sobre el mismo archivo. El hook de pre-commit lo formatea con Prettier.
4. Commit con el formato del repo: `docs(<servicio>): add Postman collection for the <Servicio> REST API`.

## 9. Checklist

- [ ] Archivo en `apps/apiv1/<servicio>/postman/`, formato v2.1.
- [ ] Todas las variables son de colección y usan los nombres estándar.
- [ ] Ningún *Initial value* contiene credenciales ni tokens.
- [ ] Auth de colección *API Key* `Authorization: {{idToken}}` y scripts de colección copiados de una colección de referencia.
- [ ] Están todas las rutas del stack y del `handler.mjs`.
- [ ] URLs con `{{baseUrl}}/<basePath>` y `:id`.
- [ ] Solo `GET` y `POST`.
- [ ] Las dependencias del alta se obtienen con una petición de preparación, no con ids a mano.
- [ ] El flujo CRUD se ejecuta de principio a fin con el Runner.
- [ ] Las carpetas 1 y 4 crean y borran sus propios datos.
- [ ] Ningún caso negativo puede modificar datos reales si su validación fallara.
- [ ] Cada petición tiene test de status y los defectos van marcados con ⚠️.
- [ ] Ejecutada completa contra desarrollo, en verde.
