<!--
Checklist para Pull Request — v2.0 (2026-09-10)
Marca cada casilla solo cuando sea cierta. Lo que no aplique, táchalo y di por qué.
Referencias: docs/guides/definition-of-done.md · docs/guides/architecture.md (Guía A) ·
docs/guides/style-and-conventions.md (Guía B) · docs/guides/tooling-decisions.md (Guía C)
Cada casilla explicada con ejemplos: docs/guides/pr-checklist-guide.md
-->

## Descripción

<!-- Qué problema resuelve y por qué se eligió este enfoque. -->

**Ticket:** KTSS-000
**ADR / decisión de diseño (si aplica):**

## Cómo probarlo

<!-- Pasos concretos o comando para reproducir el escenario. -->

## Riesgos

<!-- Qué puede romperse, qué queda fuera de alcance, qué necesita seguimiento. -->

## Capturas o payloads de ejemplo

<!-- Obligatorio si hay cambios visibles o de contrato. -->

## Notas de despliegue

- Variables de entorno nuevas (ya en `.env.example`):
- Orden de migraciones:
- Colas, ARN y permisos IAM nuevos:
- Feature flags:

## Evidencia

- Enlace o captura del escaneo SonarQube local (`./sonar.sh` del paquete tocado):
- Resumen de `test:coverage` del paquete tocado:
- Si el cambio toca `@kace/core/src/shared`: suite completa de core ejecutada en local: sí / no aplica

---

## Checklist

### Alcance

- [ ] El PR resuelve un solo propósito (feature, fix o refactor; no mezclados)
- [ ] Está por debajo de ~400 líneas reales; si no, está dividido en PRs encadenados
- [ ] No hay archivos tocados por accidente (formateo masivo, lockfiles innecesarios, configuración local)

### Rama y commits

- [ ] Rama con patrón `(feature|bugfix|hotfix)/TICKET-123-descripcion` o `release/x.y.z`
- [ ] Commits en formato Conventional Commits (`tipo(alcance): descripción`)
- [ ] Rebasada sobre `origin/develop` antes de pedir revisión

### Funcionalidad

- [ ] Cumple todos los criterios de aceptación del ticket, no solo el camino feliz
- [ ] Casos borde identificados y resueltos: vacíos, nulos, duplicados, concurrencia, timeouts, multi-tenant
- [ ] Los errores se propagan con contexto útil y por el contrato público de errores; nada se traga en silencio
- [ ] Probado manualmente al menos una vez en local, con el escenario descrito arriba

### Reglas de arquitectura (bloqueantes, Guía A)

- [ ] Solo `GET`, `POST` y `OPTIONS`; escrituras como `POST` sobre subrecurso
- [ ] Un controlador por endpoint; `handler.mjs` termina en `controller.run()`; permisos por ruta, nunca por `httpMethod`
- [ ] Todo handler bajo `withTenantContext`; sin `process.env` para configuración por tenant
- [ ] Todo repositorio extiende `KnexRepository` y recibe objetos de configuración; lecturas por `this.read`, escrituras por `this.table()`
- [ ] SQL crudo con valores como bindings e identificadores contra allowlist
- [ ] Sin ramas `sqlite3`; sin barrel files; imports directos al módulo
- [ ] Handlers de eventos en `application/event-handlers/`, nombre `<Verbo>On<Evento>`, `handle(domainEvent)` de un argumento
- [ ] Frontend: módulo nuevo en `src_v2/features/` con `pnpm run kace`; componentes sin Axios; datos de servidor solo por TanStack Query; Redux solo UI; formularios con Joi + React Hook Form

### Diseño

- [ ] La lógica de negocio vive en `domain`; la orquestación en `application`; la infraestructura no se filtra hacia adentro
- [ ] No se duplica algo ya resuelto en `@kace/core` u otro paquete del monorepo
- [ ] Los contratos públicos (API, eventos, esquemas) no rompen consumidores existentes, o el breaking change está documentado y versionado
- [ ] Las abstracciones nuevas tienen al menos dos usos reales que las justifiquen

### Tests (Guía B §5)

- [ ] Hay tests que fallan si se revierte la lógica nueva
- [ ] Cubren los casos borde listados arriba, no solo el happy path
- [ ] Unitarios con colaboradores aislados; integración con PostgreSQL real (nunca SQLite ni mocks del repositorio); ningún servicio de terceros real
- [ ] Sin dependencias frágiles: fechas relativas o congeladas, sin orden de ejecución, sin `sleep`
- [ ] Herramienta según la capa: Jest (backend y core), Vitest (frontend), Cypress (E2E frontend), Jest + SAM Local (E2E Lambda)
- [ ] Los tests del paquete tocado pasan en local; `tests-passed` en verde en CI
- [ ] Cobertura ≥ 80 % sobre el código nuevo y la global del paquete no baja
- [ ] Cadenas visibles nuevas en `en.json` y `es.json`; `validate-translations` en verde

### Seguridad

- [ ] Todo input externo se valida en el borde con Joi
- [ ] La autorización se verifica por recurso: `ObjectIdentityAuthorization` para ids del cuerpo; `pnpm run search-auth:check` en verde para búsquedas
- [ ] Sin secretos en el código; los logs no exponen datos sensibles
- [ ] Sin consultas N+1 ni listados sin paginación
- [ ] Cumple los checklists de Seguridad Informática (`docs/CheckListSeguridadBackend.pdf`, `docs/CheckListSeguridadFrontend.pdf`)
- [ ] Escaneo SonarQube local sin Blocker/Critical nuevos ni vulnerabilidades; exclusiones de regla con `// SONAR-EXC: <motivo>`
- [ ] `security-scan` en verde; ninguna entrada nueva en `.trivyignore` sin motivo, alcance, responsable y fecha de caducidad

### Base de datos y migraciones

- [ ] Cambios de esquema solo por migraciones Knex, reversibles y con `down` probado; `test-database` en verde
- [ ] Compatibles con la versión anterior desplegada (expand/contract) y probadas sobre una copia con datos
- [ ] Sin `notNullable()` ni `defaultTo()` en migraciones nuevas (salvo PK, FK, índices únicos y `deleted_at`); tipo y longitud solo si es necesario
- [ ] Índice explícito en toda FK por la que se filtra; DDL en runtime con `withSchema(this.schema)`; `table.jsonb()` directo

### Infra y despliegue

- [ ] Variable de entorno nueva declarada en `.env.example`; `pnpm run validate:env:deploy` en verde
- [ ] Stack publicador con `grantEventPublishingPermissions` y ARN en `perBcArns`; cola nueva con URL en el tenant
- [ ] Stack manual con `DB_TARGET` cableado
- [ ] `cdk:synth` del servicio tocado pasa en local

### Higiene y estilo (Guía B §1-2, §6)

- [ ] Sin código muerto, `console.*` ni TODOs sin ticket
- [ ] Nombres que revelan intención; comentarios que explican el por qué
- [ ] Prettier y ESLint del paquete sin errores; `tsc` en verde en stacks CDK; build de la app pasa
- [ ] Dependencias nuevas justificadas en la descripción (por qué esta y no la que ya está)

### Revisión

- [ ] Si el cambio toca contratos públicos, seguridad, autorización o migraciones, solicito **segunda aprobación** al Tech Lead

---

**Regla de cierre.** Si al leer tu propio diff necesitas explicar algo en voz alta al revisor, eso debería estar en un comentario del código o en la descripción del PR. El revisor no debería tener que preguntarte para entenderlo.
