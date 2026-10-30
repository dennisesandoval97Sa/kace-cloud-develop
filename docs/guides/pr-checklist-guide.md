# Guía del Checklist de Pull Request, con ejemplos

**Versión 1.00 — Documento de apoyo (no normativo)**

| Versión | Fecha | Descripción | Autor(es) |
| :---- | :---- | :---- | :---- |
| 1.00 | 2026-09-10 | Creación. Acompaña a la plantilla de PR v2.0 | Jose Roberto García López |

Este documento explica **cada casilla** de la [plantilla de PR](../../.github/PULL_REQUEST_TEMPLATE.md): qué significa, por qué existe, un ejemplo de lo que no pasa y otro de lo que sí, y cómo comprobarlo antes de marcarla. La norma está en la [Guía A](architecture.md), la [Guía B](style-and-conventions.md), la [Guía C](tooling-decisions.md) y la [Definition of Done](definition-of-done.md); si esta guía y ellas difieren, mandan ellas.

Los ejemplos usan nombres reales del repositorio (`cases`, `boards`, `KnexCaseRepository`…) para que sean reconocibles, pero están recortados.

---

## 0. La cabecera del PR

### Descripción

**Qué se pide.** El problema que resuelve el PR y por qué se eligió este enfoque, no un resumen del diff.

❌
> Se agregan cambios en el módulo de casos.

✅
> Al reabrir un caso cerrado hace más de 30 días, la SLA se recalculaba desde la fecha de creación y el caso nacía vencido. Ahora la ventana de reapertura se lee de `global_configurations` (`reopen_window_days`) y la SLA arranca en la fecha de reapertura. Se descartó calcularla en el frontend porque el mismo caso se reabre también desde acciones automatizadas.

### Cómo probarlo

**Qué se pide.** Pasos o un comando que el revisor pueda ejecutar sin preguntarte nada.

✅
```
1. pnpm --filter @kace/core run test:ctx tests/cases/application/re-open
2. En local: crear un caso, cerrarlo, cambiar reopen_window_days a 1 en global_configurations,
   reabrirlo con POST /cases/{id}/re-open y comprobar que fecha_vencimiento_ans es hoy + SLA.
```

### Riesgos

**Qué se pide.** Qué puede romperse, qué queda fuera y qué necesita seguimiento.

✅
> Toca `CaseReOpener`, que también usa el worker de acciones. Fuera de alcance: la reapertura masiva desde boards (ticket KTSS-3470). Seguimiento: la caché de `global_configurations` tarda 5 min en refrescarse; un cambio del parámetro no aplica de inmediato.

### Capturas o payloads de ejemplo

Obligatorio si el cambio se ve (pantalla) o cambia un contrato (request o response). Un payload de request y otro de response bastan:

```json
POST /cases/{id}/re-open
{ "motivo": "Cliente reporta que el problema persiste" }

200
{ "data": { "id": "…", "estado": "abierto", "fecha_vencimiento_ans": "2026-09-12T15:00:00Z" } }
```

### Notas de despliegue

Lo que Operaciones necesita saber antes de desplegar. Si no hay nada, se escribe "ninguna" en cada línea, no se deja vacío.

✅
```
- Variables de entorno nuevas: REOPEN_WINDOW_DEFAULT_DAYS (ya en .env.example)
- Orden de migraciones: 20260910120000_add_reopen_window_to_global_configurations antes del deploy de cases
- Colas, ARN y permisos IAM nuevos: ninguna
- Feature flags: ninguna
```

### Evidencia

- **SonarQube**: captura o enlace del proyecto `KCRM_KACE_CLOUD_kace_cloud_api_cases_1.24.5` tras ejecutar `./sonar.sh` en `apps/apiv1/kace_cloud_api_cases`.
- **Cobertura**: las líneas `Statements / Branches / Functions / Lines` del resumen de `pnpm --filter @kace/core run test:coverage`.
- **Suite completa de core**: "sí, 660/660 verde" o "no aplica: el cambio no toca `src/shared`".

---

## 1. Alcance

### El PR resuelve un solo propósito

**Qué significa.** Feature, fix o refactor; no dos de ellos en el mismo PR.

**Por qué.** Un refactor mezclado con un fix impide revertir el fix sin perder el refactor, y el revisor no puede distinguir qué líneas cambian comportamiento.

❌ Un PR "feat(cases): reopen window" que además renombra `CaseFinder` a `CaseLocator` en 40 archivos.

✅ Dos PRs encadenados: primero `refactor(cases): rename CaseFinder to CaseLocator`, después `feat(cases): configurable reopen window` sobre el anterior.

**Cómo lo verifico.** Leo mi propio diff: si hay archivos que no hacen falta para el título del PR, sobran.

### No hay archivos tocados por accidente

❌ El diff incluye `pnpm-lock.yaml` con 800 líneas porque se ejecutó `pnpm install` sin lockfile congelado, o `.vscode/settings.json`, o 30 archivos reformateados por un editor con otra configuración de Prettier.

✅ `git status` antes del push muestra solo los archivos del cambio; el lockfile cambia solo si se añadió o actualizó una dependencia a propósito.

---

## 2. Rama y commits

### Rama con patrón `(feature|bugfix|hotfix)/TICKET-123-descripcion`

**Por qué.** `branch-naming.yml` rechaza el PR si no cumple; el ticket en el nombre enlaza el código con Jira.

❌ `feature/reopen-window`, `fix/KTSS3470`, `feature/ktss-3470-Reopen-Window`

✅ `feature/KTSS-3470-reopen-window`, `bugfix/AMNP-562-email-recipient-validation`, `hotfix/KTSS-3456-userlist-order`, `release/1.25.0`

### Commits en formato Conventional Commits

❌ `arreglos`, `WIP`, `Fix reopen`, `feat: cambios varios en casos y usuarios`

✅
```
feat(cases): read reopen window from global configuration

La ventana estaba fija en 30 días en CaseReOpener. Ahora se lee de
global_configurations.reopen_window_days con 30 como valor por defecto.

Closes KTSS-3470
```

Tipos: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `style`, `chore`. Alcance: el bounded context o la app (`cases`, `boards`, `kace-saas`, `ci`, `deps`).

### Rebasada sobre `origin/develop`

**Por qué.** El ruleset descarta las aprobaciones al hacer push; si rebaso después de que aprueben, hay que volver a pedir revisión. Y un PR desactualizado puede pasar CI en su rama y fallar al fusionar.

```
git fetch origin && git rebase origin/develop && git push --force-with-lease
```

---

## 3. Funcionalidad

### Cumple todos los criterios de aceptación, no solo el camino feliz

❌ El ticket dice "el agente puede reabrir un caso cerrado dentro de la ventana configurada; fuera de ella recibe un mensaje claro". El PR implementa la reapertura y, fuera de la ventana, devuelve un 500 genérico.

✅ Dentro de la ventana: 200 y caso abierto. Fuera: 422 con código público `CASE_REOPEN_WINDOW_EXPIRED` y el mensaje traducido en el frontend. Ambos con test.

### Casos borde: vacíos, nulos, duplicados, concurrencia, timeouts, multi-tenant

Preguntas que hacerse por cada entrada y cada operación:

| Borde | Ejemplo en KACE |
| :--- | :--- |
| Vacío / nulo | `reopen_window_days` no configurado en el tenant → se usa el valor por defecto, no `NaN` días |
| Duplicado | Dos clics en "Reabrir" → la segunda petición no crea dos entradas de historial ni dispara dos veces las acciones |
| Concurrencia | Reapertura mientras el worker cierra el caso por SLA → una de las dos operaciones pierde, con error claro, no un estado mixto |
| Timeout | El bus de eventos tarda → la respuesta HTTP no espera al procesamiento asíncrono |
| Multi-tenant | El parámetro se lee del tenant de la petición, nunca de `process.env` ni de otro esquema |

### Los errores se propagan con contexto útil y por el contrato público

**Por qué.** Un `catch` vacío convierte un fallo de base de datos en "el botón no hace nada". Y un mensaje libre no lo puede traducir el frontend.

❌
```javascript
try {
    await reOpener.execute(id);
} catch (e) {
    return HttpResponse.ok({});
}
```

✅
```javascript
if (!window.allows(kase.fecha_cierre)) {
    throw new CustomError('Reopen window expired', 422, ['fecha_cierre'], 'CASE_REOPEN_WINDOW_EXPIRED');
}
```
El código `CASE_REOPEN_WINDOW_EXPIRED` se da de alta en el catálogo de `@kace/error-codes` (ADR-020) y el frontend lo traduce en `errors/publicErrorCodeI18n`.

### Probado manualmente al menos una vez en local

Los tests prueban lo que uno pensó; la prueba manual encuentra lo que no. Se describe el escenario en "Cómo probarlo" y se ejecuta de verdad, con SAM Local o `@kace/local-server` y el frontend en `pnpm run dev`.

---

## 4. Reglas de arquitectura (bloqueantes)

### Solo `GET`, `POST` y `OPTIONS`

**Por qué.** Seguridad Informática solo autoriza esos métodos. Un `PUT` en API Gateway se bloquea en el WAF y el frontend recibe un 403 que parece de autenticación.

❌ `apiService.put(\`/cases/${id}\`, body)` · `DELETE /cases/{id}` · `allowMethods: ['GET', 'POST', 'PUT']`

✅ `POST /cases/{id}/re-open` · `POST /cases/{id}/delete` (remapeado a `GET` dentro del handler) · `apiService.post(API.ENDPOINTS.CASES.REOPEN(id), body)`

### Un controlador por endpoint; `handler.mjs` termina en `controller.run()`

**Por qué.** `run()` encadena autenticación, enrutado a `action*`, `destroyDbConnection()` y la rotación de la `session_key` de Active Directory. Un método propio se salta todo eso en silencio.

❌
```javascript
if (event.resource === '/{id}/re-open') {
    const controller = new Controller(event, knexConfig);
    return controller.runReOpen();          // esquiva run()
}
```

✅
```javascript
if (event.resource === '/{id}/re-open' && event.httpMethod === 'POST') {
    controller = new ReOpenController({ ...event, resource: '/' }, knexConfig);
} else {
    controller = new Controller(event, knexConfig);
}
return controller.run();
```
y `ReOpenController extends BaseController` implementa `actionCreate()`.

**Señal de alarma.** Un `actionCreate` que hace `if (body.mode === 'reopen') {...} else {...}`: falta un controlador.

### Todo handler bajo `withTenantContext`; sin `process.env` para configuración por tenant

❌
```javascript
const bucket = process.env.ATTACHMENTS_BUCKET;              // es por tenant
const knex = knexLib(process.env.DB_URL);
export const handler = async (event) => { ... };
```

✅
```javascript
const baseHandler = async (event) => {
    const { knexConfig, readerConfig } = event.tenantContext;
    ...
};
export const handler = withTenantContext(baseHandler);
```
`process.env` solo para configuración de despliegue: `APPS_ENVIRONMENT`, `DB_TARGET`, `SQL_GUARD_MODE`.

### Todo repositorio extiende `KnexRepository` y recibe objetos de configuración

❌
```javascript
export class ReopenAuditRepository {
    constructor(knex) { this.knex = knex; }                 // instancia, no config
    findByCase(id) { return this.knex('tenant_x.reopen_audit').where({ case_id: id }); }
}
```
Pierde el esquema del tenant, la separación lectura/escritura, `destroyConnection()` y cualquier mejora futura de la base.

✅
```javascript
export class KnexReopenAuditRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'reopen_audit', readerConfig);
    }
    findByCase(caseId) {
        return this.read.table().where({ case_id: caseId });   // lectura → réplica si DB_TARGET lo permite
    }
    async save(entry) {
        await this.table().insert(entry);                      // escritura → primario
    }
}
```
**Cómo lo verifico.** Si tengo que escribir `\`${schema}.tabla\`` a mano, no estoy extendiendo la base.

### SQL crudo con valores como bindings e identificadores contra allowlist

❌
```javascript
knex.raw(`SELECT * FROM cases WHERE folio = '${folio}'`);
query.orderByRaw(`${column} ${direction}`);
```

✅
```javascript
knex.raw('SELECT * FROM ?? WHERE folio = ?', [this.qualifiedName(), folio]);

const SORTABLE = new Set(['folio', 'created_at', 'fecha_vencimiento_ans']);
if (!SORTABLE.has(column)) throw new ValidationFailError('sort', 'column not allowed');
query.orderBy(column, direction === 'desc' ? 'desc' : 'asc');
```
`SQLInjectionGuard` no sustituye esto: es defensa en profundidad y en `observe` no bloquea.

### Sin ramas `sqlite3`; sin barrel files; imports directos

❌
```javascript
if (knex.client.config.client === 'sqlite3') { table.text('data'); } else { table.jsonb('data'); }
import { CaseCreator, CaseFinder } from '@kace/core/src/cases';        // index.js
```

✅
```javascript
table.jsonb('data');
import { CaseCreator } from '@kace/core/src/cases/application/create/CaseCreator.js';
```
**Por qué.** SQLite oculta errores que PostgreSQL sí da; el barril carga 788 módulos, rompe `jest.unstable_mockModule` y alarga el arranque en frío.

### Handlers de eventos en `application/event-handlers/`, `<Verbo>On<Evento>`, `handle(domainEvent)`

❌ `apps/apiv1/kace_cloud_api_event_processor/src/handlers/reopenNotifier.mjs` con `async handle(context, event) { const users = context.userRepository... }`

✅ `packages/kace_cloud_core/src/cases/application/event-handlers/NotifyAgentOnCaseReopened.js`:
```javascript
export default class NotifyAgentOnCaseReopened {
    #notifier; #caseRepository;
    constructor(notifier, caseRepository) { this.#notifier = notifier; this.#caseRepository = caseRepository; }
    async handle(domainEvent) { ... }              // un solo argumento
}
```
La construcción por tenant (`new NotifyAgentOnCaseReopened(notifier, new KnexCaseRepository(knexConfig))`) se queda en `handlerFactories` del `event_processor`.

### Frontend: `src_v2/features/`, sin Axios en componentes, TanStack Query, Redux solo UI, Joi + RHF

❌
```jsx
// src/pages/Reopen/ReopenHandler.jsx  ← página nueva en la generación 1
const [cases, setCases] = useState([]);
useEffect(() => { axios.get('/cases').then((r) => setCases(r.data)); }, []);   // fetch en componente
dispatch(setCases(r.data));                                                      // datos de servidor en Redux
```

✅
```
pnpm run kace -- reopen-requests        → src_v2/features/reopen-requests/
```
```javascript
// services/reopen-requests.service.js
export const fetchReopenRequests = async (params) => (await apiService.get(API.ENDPOINTS.REOPEN.ROOT, { params })).data;
// hooks/useReopenRequests.hook.js
export const useReopenRequests = (params) => useQuery(['reopen-requests', params], () => fetchReopenRequests(params));
// components/ReopenRequestsList.jsx
const { data, isLoading } = useReopenRequests(filters);
```
Redux solo para `modalBehavior`, `user`, `groupInformation` y similares. El formulario valida con `useForm({ resolver: joiResolver(reopenSchema) })`.

---

## 5. Diseño

### La lógica de negocio vive en `domain`; la orquestación en `application`

❌ El controlador calcula si el caso está dentro de la ventana de reapertura y, si no, devuelve 422.

✅ `Case.canBeReopened(window)` en el agregado decide; `CaseReOpener` (application) lo invoca, persiste y publica `CaseReopened`; el controlador solo valida el body con Joi, llama al caso de uso y traduce el error a HTTP.

### No se duplica algo ya resuelto

Antes de escribir un helper, buscar: `grep -rn "function normalize" packages/kace_cloud_core/src/shared`. Ejemplos de cosas que ya existen y se reescriben a menudo: `Helper` (fechas, uuids), `AdvancedSearch`, `EntityCache`, `useDataTable`, `useGeneralMutation`, `genericSearchService`, `textNormalize`.

### Los contratos públicos no rompen consumidores

❌ Renombrar `fecha_vencimiento_ans` a `sla_due_date` en `CaseResponse` sin tocar el frontend ni las integraciones REST de los clientes.

✅ Añadir el campo nuevo, mantener el antiguo marcado como deprecated en el DTO y en `docs/`, y abrir el ticket de retirada. Si el cambio es inevitable, ADR y nota en `BREAKING_CHANGES.md`.

### Las abstracciones nuevas tienen al menos dos usos reales

❌ Crear `AbstractWindowPolicy` con `ReopenWindowPolicy` como única implementación "por si mañana hay otra ventana".

✅ Una función `isWithinReopenWindow(closedAt, days, now)` en el dominio. Cuando aparezca la segunda ventana, se extrae la abstracción con dos casos delante.

---

## 6. Tests

### Hay tests que fallan si se revierte la lógica nueva

**Cómo lo verifico.** `git stash` del cambio de producción (no del test), correr el test, ver rojo, `git stash pop`. Si sigue verde, el test no prueba nada.

❌
```javascript
it('reabre el caso', async () => {
    await reOpener.execute(id);
    expect(true).toBe(true);
});
```

✅
```javascript
it('rechaza la reapertura pasada la ventana configurada', async () => {
    // Arrange
    const kase = await CasesMother.createClosedCase(repository, { fecha_cierre: daysAgo(31) });
    // Act & Assert
    await expect(new CaseReOpener(repository, config(30)).execute(kase.id.value))
        .rejects.toThrow(CaseReopenWindowExpiredError);
});
```

### Cubren los casos borde listados arriba

Por cada fila de la tabla de bordes de la sección 3, un `it`. Si el ticket lista cuatro bordes y el PR trae un test, falta trabajo.

### Unitarios aislados; integración con PostgreSQL real; ningún servicio de terceros real

❌ `knexLib({ client: 'sqlite3', connection: ':memory:' })` en un test de repositorio · `jest.spyOn(KnexCaseRepository.prototype, 'save')` en un `*.integration.test.js` · un test que envía un correo por SMTP real.

✅ Test de repositorio con `knexConfig` de `tests/knexfile.js` (cada archivo tiene su base clonada); test unitario de `CaseReOpener` con un repositorio en memoria; S3 y SES sustituidos por mocks del SDK que drenan el `Body`.

### Sin dependencias frágiles

❌ `expect(result.fecha_vencimiento_ans).toBe('2026-09-12T15:00:00Z')` · `await new Promise((r) => setTimeout(r, 500))` · un test que solo pasa si otro se ejecutó antes.

✅ `jest.useFakeTimers().setSystemTime(new Date('2026-09-10T10:00:00-05:00'))` y fechas relativas (`daysAgo(31)`); esperar con `await` a la promesa real, no al reloj; cada `it` siembra lo que necesita en `beforeEach`.

Trampas conocidas: entre 23:00 y 23:59 en `America/Bogota` ya es otro día en UTC; la fila `ans` sembrada en la plantilla envejece y una ventana "últimos 7 días" deja de incluirla.

### Herramienta según la capa

| Cambio en… | Test con… |
| :--- | :--- |
| `packages/kace_cloud_core` | Jest, `tests/<contexto>/…` |
| `apps/apiv1/*` | Jest, `test/*.test.mjs`; E2E con SAM Local si se añade un endpoint |
| `apps/kace-saas` componentes, hooks | Vitest + Testing Library |
| Flujo de usuario que cruza pantallas | Cypress, `src_v2/features/<feature>/e2e/` |

### Los tests del paquete tocado pasan en local; `tests-passed` en verde

```
pnpm --filter @kace/core run test:ctx tests/cases          # lo tocado
pnpm --filter @kace/api-cases test                         # el microservicio
pnpm --filter ./apps/kace-saas run test -- --run           # el frontend
```
Si el cambio toca `packages/kace_cloud_core/src/shared`: `pnpm --filter @kace/core run tests` completo antes de abrir el PR, y se declara en "Evidencia".

### Cobertura ≥ 80 % sobre el código nuevo y la global no baja

```
pnpm --filter @kace/core run test:coverage 2>&1 | tail -8
```
Se pegan las cuatro líneas del resumen en "Evidencia". Si un archivo nuevo aparece con 40 %, faltan tests para sus ramas, no basta con que el total sea 80 %.

### Cadenas visibles en `en.json` y `es.json`

❌ `<Button>Reabrir caso</Button>`

✅ `<Button>{t('cases.reopen.action')}</Button>` con la clave en los dos archivos, y `pnpm --filter ./apps/kace-saas run validate-translations` sin diferencias.

---

## 7. Seguridad

### Todo input externo se valida en el borde con Joi

❌ El controlador lee `event.body.days` y lo pasa al caso de uso sin esquema.

✅ En `schemas.mjs`:
```javascript
export const schemaReOpen = Joi.object({
    motivo: Joi.string().min(3).max(500).required(),
});
```
y el controlador valida antes de tocar el dominio. El dominio vuelve a validar invariantes en Value Objects (`ValueObjectString` rechaza nulos, longitud y patrones peligrosos), pero eso no sustituye a Joi en el borde.

### Autorización por recurso

**Qué significa.** Estar autenticado no basta: hay que comprobar que el usuario puede actuar sobre **ese** recurso.

❌ `actionRead` devuelve el caso por `id` sin comprobar grupo ni tenant; un `id` enviado en el body de `create` se acepta tal cual.

✅ Los ids que llegan en el cuerpo pasan por `resolveCanonicalCreateIdentity` y `assertCreateRouteUpdateAuthorized` de `ObjectIdentityAuthorization`; las búsquedas pasan por `SearchAuthorizationService` (`#authorizeSearch` en `cases/controller.mjs`) y `pnpm run search-auth:check` confirma que el endpoint nuevo está inventariado.

### Sin secretos en el código; logs sin datos sensibles

❌ `const token = 'sq_9f8e…'` en `sonar.sh` · `logger.info('login', { email, password })` · un `.env.natura` añadido al repo.

✅ Tokens por consola o variables de entorno; logs con `request_id`, `tenant` y el id del recurso, nunca con PII ni credenciales. Trivy bloquea el PR si detecta un secreto.

### Sin consultas N+1 ni listados sin paginación

❌
```javascript
const cases = await repository.findByGroup(groupId);
for (const kase of cases) { kase.client = await clientRepository.find(kase.cliente_id); }   // N+1
return HttpResponse.ok(await repository.findAll());                                          // sin límite
```

✅ Un `whereIn('id', clientIds)` o un `join`; todo listado con `limit` y `offset` (o cursor) y un tope máximo en el esquema Joi (`limit: Joi.number().max(200)`).

### Checklists de Seguridad Informática

Se repasan los PDF de `docs/` (backend y frontend) marcando los puntos que aplican al cambio: cabeceras, manejo de sesiones, validación de archivos, CSP. Si un punto no aplica, se dice cuál y por qué.

### SonarQube local sin Blocker/Critical nuevos

```
cd apps/apiv1/kace_cloud_api_cases && ./sonar.sh
```
Se revisa la pestaña *New Code* del proyecto. Una regla que no aplica se excluye en la línea con motivo:
```javascript
// SONAR-EXC: NODEJS No expone logs porque es server-side
console.error(`Error reading file: ${filePath}`);
```

### `security-scan` en verde; `.trivyignore` con motivo, alcance, responsable y caducidad

❌ Añadir `CVE-2026-73231` a `.trivyignore` sin más.

✅
```
# Motivo: no hay versión parcheada de faker-js compatible con Node 22 aún
# Alcance: solo devDependency de @kace/perf; no llega a producción
# Responsable: equipo KACE
CVE-2026-73231 exp:2026-09-24
```
Plazos: Critical 48 h, High 14 d, Medium 45 d. Antes de excluir, intentar `overrides` en `pnpm-workspace.yaml`.

---

## 8. Base de datos y migraciones

### Migraciones Knex reversibles con `down` probado

❌ `ALTER TABLE` ejecutado a mano en el tenant de pruebas; migración con `down() {}` vacío.

✅
```javascript
export async function up(knex) {
    await knex.schema.alterTable('global_configurations', (t) => {
        t.integer('reopen_window_days');
    });
}
export async function down(knex) {
    await knex.schema.alterTable('global_configurations', (t) => { t.dropColumn('reopen_window_days'); });
}
```
y en local: `pnpm run migrate:latest && pnpm run migrate:rollback && pnpm run migrate:latest`. CI lo repite en `test-database`. Las migraciones **no** cualifican el esquema: `@kace/database` las ejecuta con `searchPath: [DB_SCHEMA]`, una vez por tenant.

### Compatibles con la versión anterior desplegada (expand/contract)

**Por qué.** Los 95 Lambdas no se despliegan a la vez; durante minutos conviven código viejo y esquema nuevo.

❌ Renombrar la columna `motivo_baja` a `motivo_cierre` en una sola migración: el código viejo falla hasta que termine el deploy.

✅ PR 1: añadir `motivo_cierre` y escribir en ambas. PR 2 (tras el deploy): leer solo de la nueva. PR 3: eliminar `motivo_baja`.

### Sin `notNullable()` ni `defaultTo()` en migraciones nuevas

**Por qué.** Las reglas de negocio viven en los Value Objects; una columna neutra permite cambiar la regla sin migración. Se exceptúan PK, FK, índices únicos y `deleted_at`.

❌ `t.integer('reopen_window_days').notNullable().defaultTo(30);`

✅ `t.integer('reopen_window_days');` y en el dominio `new ValueObjectInt('Reopen window', value ?? DEFAULT_REOPEN_WINDOW_DAYS)`.

### Índice explícito en toda FK filtrada; DDL en runtime con `withSchema`; `table.jsonb()`

**Por qué.** `table.foreign()` no crea índice en PostgreSQL: `aux_clients` sin índice fue el 97 % de la carga de base de datos en una prueba real.

❌ `t.uuid('case_id').references('id').inTable('cases');` y luego `where({ case_id })` en el repositorio.

✅
```javascript
t.uuid('case_id').references('id').inTable('cases');
t.index('case_id', 'idx_reopen_audit_case_id');
```
Las tablas `history_*` nuevas indexan `entity_id` (ver `20260629120000_table_history_rel_usuarios_grupos.js`). Sin `if (client === 'sqlite3')`; `t.jsonb('data')` directo.

El `withSchema` aplica al DDL que se ejecuta **en runtime** desde un repositorio (por ejemplo, `KnexAuxDefinitionsRepository` crea tablas auxiliares por tenant): ahí `knex.schema.withSchema(this.schema).createTable(...)`, porque sin cualificar la tabla cae en `public` y el tenant recibe "permission denied for schema public".

---

## 9. Infra y despliegue

### Variable de entorno nueva en `.env.example`; `validate:env:deploy` en verde

**Por qué.** `validate-env-deploy.sh` exige cada clave no comentada de `.env.example`; si la variable se usa pero no está ahí, el deploy de los 95 servicios se detiene, o peor, despliega sin ella.

✅
```
# Días por defecto de la ventana de reapertura cuando el tenant no la configura
REOPEN_WINDOW_DEFAULT_DAYS=30
```
y `pnpm run validate:env:deploy` sin errores (el hook `pre-push` corre la versión no estricta).

### Stack publicador con `grantEventPublishingPermissions` y ARN en `perBcArns`; cola con URL en el tenant

**Por qué.** Sin el grant, `SendMessage` devuelve `AccessDenied` en runtime y el deploy queda en verde. Sin la URL en el tenant, el bus cae a memoria y se pierden todos los eventos del tenant.

✅ En `lib/<name>-stack.ts`: `this.grantEventPublishingPermissions(lambdaFunction);` · el ARN de la cola en `perBcArns` de `KApiStack` · la URL en `kace_multi_tenancy` para cada tenant · ARN y URL de la **misma** cuenta.

### Stack manual con `DB_TARGET` cableado

Si el stack no usa `setDefaultOptions` (como `cases-stack.ts`), añadir `lambdaFunction.addEnvironment('DB_TARGET', …)`; si no, la réplica queda inactiva y nadie lo nota.

### `cdk:synth` pasa en local

```
cd apps/apiv1/kace_cloud_api_cases && pnpm run cdk:synth
```

---

## 10. Higiene y estilo

### Sin código muerto, `console.*` ni TODOs sin ticket

❌ `// const oldWindow = 30;` · `console.log('reopen', id);` · `// TODO: revisar`

✅ ESLint (`no-console`) falla; el TODO lleva ticket: `// TODO(KTSS-3475): retirar motivo_baja tras el deploy 1.26`.

### Nombres que revelan intención; comentarios que explican el por qué

❌ `const d = 30; // días` · `function process(data)`

✅ `const DEFAULT_REOPEN_WINDOW_DAYS = 30;` · `function isWithinReopenWindow(closedAt, windowDays, now)` · comentario que explica un porqué no evidente:
```javascript
// Se compara en la zona del tenant: un cierre a las 23:30 de Bogotá ya es "mañana" en UTC
```

### Prettier, ESLint, `tsc` y build

```
pnpm --filter @kace/api-cases run format:check && pnpm --filter @kace/api-cases run eslint-check
pnpm --filter @kace/api-cases run build          # tsc del stack CDK
pnpm --filter ./apps/kace-saas run build
```

### Dependencias nuevas justificadas

❌ Añadir `moment` cuando el repo ya usa `dayjs` vía `DayjsFactory`.

✅ En la descripción: "Se añade `p-limit` para acotar la concurrencia del fan-out a la FIFO; `Promise.all` sin límite supera las 300 TPS. No hay equivalente en el monorepo".

---

## 11. Revisión

### Segunda aprobación para contratos públicos, seguridad, autorización o migraciones

El ruleset de `develop` exige una aprobación. Si el PR toca `schemas.mjs`, `@kace/api-common/src/security`, `migrations/` o un DTO de respuesta, se menciona al Tech Lead en el PR pidiendo la segunda revisión y no se fusiona hasta tenerla.

---

## Regla de cierre

Si al releer tu diff te sorprendes explicando algo mentalmente al revisor ("esto es así porque…"), ese "porque" va en un comentario del código o en la descripción. El revisor no debería tener que preguntarte para entenderlo.
