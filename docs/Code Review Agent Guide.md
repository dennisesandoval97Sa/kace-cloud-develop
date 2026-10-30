# Guía del agente para Code Review (PRs)

Este documento define lo que el agente (o cualquier revisor) debe tener en cuenta al revisar pull requests en KACE Cloud, alineado con la arquitectura y convenciones del monorepo.

**Documentos relacionados**

- Plantilla de informe: [Code Review Report Template.md](./Code%20Review%20Report%20Template.md)
- Contribución y PRs: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Arquitectura: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Frontend: [frontend/README.md](./frontend/README.md)
- DDD / hexagonal: [architecture/adr/002-hexagonal-architecture-ddd.md](./architecture/adr/002-hexagonal-architecture-ddd.md)
- Multi-tenant (breaking): `BREAKING_CHANGES.md` y `TENANT_CONTEXT_USAGE.md` (raíz del repo)

---

## 1. Alcance de la revisión

1. Obtener el diff frente a la rama base acordada (habitualmente `develop`): `git diff origin/develop...HEAD`.
2. Identificar si el cambio es principalmente **frontend** (`apps/kace-saas`), **API** (`apps/apiv1/`), **core** (`packages/kace_cloud_core`), **infra** (`packages/kace_cloud_aws_infra`), **paquetes compartidos** o **mixto**.
3. Aplicar las secciones transversales siempre; profundizar en la sección Front o Back según los archivos tocados.
4. Si el PR introduce un nuevo campo en el body HTTP, verificar **Joi** en el microservicio y **consumo en el front** en el mismo informe.

---

## 2. Reglas transversales (monorepo)

### 2.1 Multi-tenancy

- No usar `process.env` para **configuración específica de tenant** en runtime en Lambdas (DB, S3, secretos por tenant). Debe venir de `event.tenantContext` / entidad `Tenant` / DynamoDB `kace_multi_tenancy`.
- Handlers de API: envolver con `withTenantContext` y leer `knexConfig` desde `event.tenantContext`.
- Peticiones HTTP desde el front deben incluir **`X-Tenant-Id`** cuando aplique (p. ej. `VITE_TENANT_ID` en el cliente configurado en el proyecto).
- Nuevos atributos de tenant: extender el agregado en `packages/kace_cloud_core` (Value Objects), no variables de entorno ad hoc.
- Eventos programados: el patrón documentado usa **orchestrator** por tenant; no invocar solo el handler de negocio sin revisar el stack CDK.
- Servicios en core pueden usar `TenantContext` (AsyncLocalStorage) para acceder al tenant dentro del ámbito del request; no sustituir manualmente el contexto fuera del middleware.

### 2.2 Lint y formato

- **ESLint** (`@kace/eslint-config`): prohibido `console.*` en código que deba cumplir la config; comillas dobles; punto y coma; indentación 4 espacios; `comma-dangle` en multilínea; nueva línea tras imports; comentarios con estilo estándar; TODO/FIXME generan advertencia.
- **Prettier** (`@kace/prettier_config`): `singleQuote: true`, `tabWidth: 4`, `printWidth: 120`, `trailingComma: es5`, `jsxSingleQuote: true`, etc. El pre-commit ejecuta Prettier en archivos staged; puede haber tensión aparente con ESLint en comillas: prevalece lo que deje el flujo del repo tras formatear.
- Raíz `.prettierignore` excluye `*.md`; no exigir que Markdown pase Prettier salvo que el equipo acuerde otra cosa.

### 2.3 Código generado por agente (Cursor)

- Regla del workspace: **no añadir comentarios** en código generado (ni `//`, ni bloque, ni JSDoc obligatorio en código nuevo del agente). El código debe ser autoexplicativo con nombres claros. La documentación va en `docs/` o en PR, no en comentarios inline innecesarios.

### 2.4 Nombrado y estructura

- Variables y funciones: `camelCase`. Clases y componentes React: `PascalCase`. Constantes de módulo: `UPPER_SNAKE_CASE` cuando aplique.
- Commits: [Conventional Commits](CONTRIBUTING.md) (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`).

### 2.5 Internacionalización (cuando hay UI)

- Textos visibles: `useTranslation` / `t()` y claves en `apps/kace-saas/src/locale/en.json` y `es.json`.
- Revisar paridad de claves entre idiomas en cambios de copy.
- Señalar textos hardcodeados en un solo idioma.

### 2.6 Git y secretos

- No commitear `.env*`, carpetas `config/` ignoradas, `cdk.out`, `.cursor/` si el equipo las excluye del control de versiones.
- No introducir credenciales, tokens o datos personales en el código.

### 2.7 Contrato front ↔ back

- Cualquier propiedad nueva en `JSON.parse(event.body)` debe existir en el **Joi** del microservicio o estar explícitamente permitida (`allowUnknown` / `stripUnknown` solo si el patrón del servicio lo usa).
- Joi 17 por defecto **rechaza claves desconocidas**: un campo que solo envía el front y no está en el schema provoca 400.
- Verificar que la **ruta y método** existan en el `Controller` del API y, si el cambio es de exposición pública, en **API Gateway / CDK** (`KApiStack`).

### 2.8 Tests

- Backend: Jest; en tests de handlers, mockear `event.tenantContext` cuando sea necesario.
- Objetivo de cobertura referido en [CONTRIBUTING.md](./CONTRIBUTING.md) (p. ej. ~80% en funciones/líneas donde aplique el paquete).
- Front: Vitest / Testing Library según el módulo; nuevas rutas críticas deberían tener al menos un test o justificación en el PR.

### 2.9 Seguridad rápida

- No loguear tokens, cookies completas ni PII innecesaria.
- Validar permisos en endpoints que mutan datos o acceden a datos sensibles (`hasPermission` u patrón del controlador).
- CORS y cabeceras alineadas con multi-tenant (`X-Tenant-Id`).

---

## 3. Backend (API y `@kace/core`)

### 3.1 Capas (DDD / hexagonal)

- Lógica de negocio en `packages/kace_cloud_core`: bounded contexts bajo `src/<contexto>/` con `domain/`, `application/`, `infrastructure/persistence/`.
- Casos de uso con nombres reconocibles: `*Creator`, `*Finder`, `*Updater`, `*Deleter`, `*Searcher`, etc.
- **Controllers** en `apps/apiv1/*/src`: enrutan, validan entrada (Joi), llaman a servicios de core; **no** deben concentrar reglas de dominio ni SQL ad hoc prolongado.
- Repositorios: `Knex*Repository` extendiendo `KnexRepository`; columnas JSON pueden requerir registro en el parseo central del repositorio base si el patrón del proyecto lo exige.

### 3.2 Handlers (`handler.mjs`)

- Patrón: `baseHandler` recibe `event`, usa `event.tenantContext.knexConfig`, instancia el `Controller`, `return (await controller.run()).toJson()` (o equivalente `HttpResponse`).
- Export: `export const handler = withTenantContext(baseHandler)`.
- Si el servicio reescribe `event.resource` antes del controller, debe coincidir con las rutas definidas en CDK y con la matriz de `BaseController`.

### 3.3 `BaseController`

- Despacho por `httpMethod` y `event.resource` (`/`, `/{id}`, `/search`, `/{id}/delete`, `/{id}/history`, `/advance-search`, etc.).
- Solo **GET** y **POST** en el flujo estándar revisado.
- `run()` carga usuario, ejecuta acción y en `finally` destruye conexión; no omitir el ciclo de vida de conexiones si se añaden rutas alternativas.

### 3.4 Validación Joi (`schemas.mjs`)

- Validar con `abortEarly: false` cuando el patrón del microservicio lo use para devolver todos los errores.
- Mantener reglas de negocio complejas en core; Joi como **frontera HTTP**.
- Revisar `allowUnknown` / defaults: campos opcionales y valores por defecto explícitos para compatibilidad.

### 3.5 Infraestructura CDK

- Nuevas Lambdas: permisos a tabla DynamoDB multitenant si resuelven tenant en runtime.
- CORS y recursos API alineados con las cabeceras y rutas reales.
- Variables de entorno en producción: muchas Lambdas tienen env **mínimo**; no asumir `DB_HOST` en prod si el tenant lo aporta vía Dynamo.

### 3.6 Pitfalls frecuentes en revisión

- `actionAdvanceSearch` en `BaseController` está pensado para un flujo concreto (permisos, `SearchSchema`, inferencia de tabla); **no** asumir que `POST /cualquier-recurso/advance-search` con query `name` y `field` funciona para reportes u otros dominios sin un `Controller` que lo implemente.
- Duplicar validación contradictoria entre Joi y entidades de dominio.
- Olvidar `X-Tenant-Id` en pruebas de integración.

---

## 4. Frontend (`apps/kace-saas`)

### 4.1 Stack y documentación

- React 18, Vite, Tailwind, Radix (vía `ui-shared`), TanStack Query, Redux Toolkit, React Router 6, i18next, Joi en formularios donde aplique.
- Detalle de carpetas y flujo de datos: [frontend/README.md](./frontend/README.md).

### 4.2 Estructura de páginas

- `src/pages/<Modulo>/`: muchas veces shell + `*Handler`, componentes locales, `hooks/` y `data/` por módulo.
- Registrar rutas en `src/config/routesDictionary.js` y coherencia con `routes`.

### 4.3 Componentes: dónde va cada cosa

- `@kace/ui-shared`: primitivos y piezas UI reutilizables, mayormente presentacionales.
- `components/core/`: piezas con comportamiento de producto (tablas, layout, flujos).
- `componentsV2/`: bloques compartidos más recientes (DataTable, Select, MultiSelect, JSONEditor, etc.).
- Evitar duplicar un componente que ya exista en `ui-shared` o `componentsV2`.

### 4.4 `src` vs `src_v2` (`@kace_v2`)

- `src`: organización clásica por página.
- `src_v2`: features por dominio (p. ej. boards), con UI tipo átomos/moléculas/organismos y servicios colocados en la feature.
- Nuevos cambios deben seguir el **mismo árbol** que la feature existente; no mezclar sin criterio.

### 4.5 Estado: React Query vs Redux

- **TanStack Query**: datos del servidor, cache, mutaciones, invalidación con `queryKey` coherentes.
- **Redux**: estado de UI global (usuario, filtros de UI, modales, banners, etc.).
- **No** persistir en Redux listas de entidades que deban vivir en el cache de Query.

### 4.6 Servicios y HTTP

- Preferir `apiService` / flujos de `@kace/utils` y helpers como `sendInformation`, `genericView`.
- Evitar múltiples clientes axios sueltos sin los interceptors del proyecto.

### 4.7 Hooks

- Hooks genéricos en `src/hooks/` (`useGenericGetQuery`, `useGenericViewQuery`, `useGeneralMutation`, `useGeneralDelete`, `usePermissionsUser`, etc.).
- Hooks de página en `pages/.../hooks/`.
- Al invalidar queries, respetar la forma de `queryKey` usada en el módulo.

### 4.8 UI / UX / a11y

- Loading y errores manejados en flujos async.
- `data-testid` donde el equipo los use para E2E.
- Keys en listas: preferir identificadores estables frente a solo `index` si la lista es dinámica.
- Accesibilidad básica: labels, foco en modales, contraste razonable con Tailwind.

### 4.9 Pitfalls frecuentes en revisión

- Rutas inconsistentes (`/report` vs `/reports`, typos) respecto al `service-manifest` o al API real.
- `MultiSelect` u otros controles: forma de los ítems (`id`, `label`, `value`) y “seleccionar todo” debe ser compatible con el payload que serializa el formulario.
- Permisos: `usePermissionsUser` y efectos con dependencias vacías pueden dejar menús desactualizados; revisar si el PR introduce condiciones de carrera.

### 4.10 Aliases (Vite)

- `@` → `src/`
- `@kace_v2` → `src_v2/`
- `@kace/ui-shared`, `@kace/utils`, `@kace/hooks`, `@kace/services`

---

## 5. Categorías sugeridas para los findings

Usar en el informe para clasificar hallazgos:

| Categoría        | Ejemplos |
|------------------|----------|
| Security         | Authz, filtrado de datos, secretos, logs sensibles |
| Correctness      | Bug lógico, condición incorrecta, off-by-one |
| API Contract     | Joi, rutas, versionado, breaking change |
| Multi-tenant     | Tenant context, env, headers |
| Architecture     | Violación de capas DDD, SQL en controller |
| Performance      | N+1, queries pesadas, re-renders innecesarios |
| Code Quality     | DRY, naming, complejidad, duplicación |
| UX / i18n        | Copy hardcodeado, estados de error vacíos |
| Testing          | Falta de tests, mocks frágiles |
| DX / Consistency | ESLint, Prettier, convenciones del repo |

---

## 6. Severidades (definición operativa)

| Nivel    | Cuándo usar |
|----------|-------------|
| CRITICAL | Vulnerabilidad, pérdida de datos, bypass de auth, producción rota inmediata |
| HIGH     | Regresión grave, contrato API roto sin migración, multi-tenant incorrecto |
| MEDIUM   | Bug en casos borde, deuda que causa bugs probables, incoherencia UX importante |
| LOW      | Estilo, micro-optimización, nitpicks con bajo impacto |
| INFO     | Sugerencia educativa, alineación futura, nota para el autor |

---

## 7. Veredictos

- **APPROVED**: Sin hallazgos CRITICAL/HIGH; MEDIUM aceptables o no bloqueantes con acuerdo explícito.
- **APPROVED WITH COMMENTS**: Mergeable con follow-ups documentados (MEDIUM/LOW).
- **CHANGES REQUESTED**: Debe corregirse antes de merge (típicamente CRITICAL/HIGH o varios MEDIUM bloqueantes).
- **REJECTED**: No adecuado en forma actual (diseño inaceptable, riesgo extremo, fuera de alcance).

---

## 8. Checklist rápido antes de cerrar el informe

- [ ] Diff revisado frente a la rama base correcta.
- [ ] Multi-tenant y headers comprobados si toca API o auth.
- [ ] Joi y payload alineados si hay cambios de request/response.
- [ ] Front: i18n y capa correcta (core / ui-shared / v2).
- [ ] Back: capas DDD y handler con `withTenantContext`.
- [ ] Tests o justificación razonable.
- [ ] Sin secretos ni `console` donde ESLint lo prohíba.
- [ ] Plantilla de informe rellenada: [Code Review Report Template.md](./Code%20Review%20Report%20Template.md)
