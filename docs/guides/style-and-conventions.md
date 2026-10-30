# Guía B — Estilo y convenciones

**Versión 1.00 — Documento normativo**

| Versión | Fecha | Descripción | Autor(es) |
| :---- | :---- | :---- | :---- |
| 1.00 | 2026-09-10 | Creación. Sustituye las secciones de estilo, TDD y documentación de la *Guía de Lineamientos y Convenciones* (v1.00, 11/03/2025) y las de convenciones de `docs/CONTRIBUTING.md` | Jose Roberto García López |

**Vigente desde:** fecha de aprobación por el Tech Lead.

Responde a: *¿cómo escribo, nombro, pruebo y entrego el código?*

Documentos hermanos: [Guía A — Arquitectura](architecture.md) · [Guía C — Decisiones de tooling](tooling-decisions.md) · [Definition of Done](definition-of-done.md) · [Checklist para PR](../../.github/PULL_REQUEST_TEMPLATE.md).

---

## 1. Formato

La norma es la configuración compartida; esta tabla la explica. Si difieren, manda la configuración y se corrige la guía.

| Regla | Valor | Fuente |
| :--- | :--- | :--- |
| Indentación | **4 espacios** | `packages/kace_cloud_prettier_config_shared/index.js` (`tabWidth: 4`), `packages/kace_cloud_eslint/index.js` (`indent: 4`) |
| Comillas | **Simples**, también en JSX | `singleQuote: true`, `jsxSingleQuote: true`; ESLint `quotes: single` |
| Punto y coma | Obligatorio | `semi: true`; ESLint `semi: always` |
| Coma final | ES5: en arrays, objetos, imports y exports multilínea; nunca en argumentos de función | `trailingComma: 'es5'`; ESLint `comma-dangle` |
| Ancho de línea | 120 | `printWidth: 120` |
| Paréntesis en arrow | Siempre | `arrowParens: 'always'` |
| `console.*` | Prohibido | ESLint `no-console: error` |
| `TODO` / `FIXME` | Aviso; solo con ticket | ESLint `no-warning-comments` |
| Comentarios multilínea | Bloque `/** */` con asterisco por línea | `multiline-comment-style: starred-block` |
| Imports | Una línea en blanco tras el bloque | `import/newline-after-import` |
| ES6+ | `const`/`let`, arrow functions en anónimas, template literals | Base `standard` |

Comandos:

| Dónde | Formato | Lint |
| :--- | :--- | :--- |
| `apps/apiv1/*` | `pnpm run format:check` / `format` | `pnpm run eslint-check` / `eslint-fix` |
| `apps/kace-saas` | `pnpm run prettier-check` | `pnpm run eslint-check` |
| `packages/*` | `pnpm exec prettier --check .` | ESLint no cableado (ver Guía C) |
| Raíz | `pnpm run prettier` formatea los archivos en *stage* (lo ejecuta el hook `pre-commit`) | — |

CI (`lint`) ejecuta Prettier sobre los archivos cambiados frente a la rama base y bloquea el PR.

---

## 2. Nomenclatura

| Elemento | Convención | Ejemplo |
| :--- | :--- | :--- |
| Variables y funciones | `camelCase` | `caseData`, `findUserById()` |
| Clases y componentes React | `PascalCase` | `CaseCreator`, `AdminCasePage` |
| Constantes | `UPPER_SNAKE_CASE` | `MAX_RETRIES`, `EVENT_NAME` |
| Propiedades de agregados | `snake_case` | `cliente_id`, `responsable_id` (reflejan columnas; ver Guía A §3.3) |
| Casos de uso | `<Agregado><Verbo>` | `CaseCreator`, `CaseFinder`, `CaseBulkCloser` |
| Handlers de eventos | `<Verbo>On<Evento>` | `ExecuteActionsOnCaseCreated` |
| Eventos | `<Agregado><AcciónEnPasado>` / `kace.core.<agregado>.<accion>` | `CaseCreated` / `kace.core.case.created` |
| Repositorios | `Knex<Agregado>Repository` | `KnexCaseRepository` |
| Value Objects | `ValueObject<Concepto>` | `ValueObjectUuid` |
| Archivos backend | `PascalCase.js` para clases; `camelCase.mjs` para handlers y utilidades | `CaseCreator.js`, `handler.mjs`, `guardCaseWrite.js` |
| Directorios nuevos | `kebab-case` | `event-handlers`, `case-attachments` |
| Componentes y páginas React | `PascalCase.jsx` | `CasesHandler.jsx`, `BoardsPage.jsx` |
| Hooks React | `useX.js` en `src/hooks`; `useX.hook.js` en `src_v2` | `useDataTable.jsx`, `useBoard.hook.js` |
| Servicios frontend v2 | `<feature>.service.js` | `boards.service.js` |
| Esquemas Joi frontend | `<Entidad>Schema.js` en `src/schemas`; `<feature>.schema.js` en v2 | `CasoSchema.js` |
| Tests | `*.test.js(x)` o `*.spec.js(x)` junto al archivo o en `__tests__/`; en core `*.integration.test.js` para los que tocan base | `CaseBulkCloser.integration.test.js` |
| `data-testid` | `kebab-case` | `boards-page` |
| Claves i18n | `dominio.seccion.clave` en `en.json` y `es.json` | `app.text.noOptions` |

Los directorios existentes que no cumplen (`aux_casos`, `ws_rest_functions`, `ClassificationsLevelDistinction`) **no se renombran** sin ticket: un renombre masivo rompe imports e historia.

---

## 3. Ramas y flujo git

```
master                      # producción; protección clásica: 2 aprobaciones + tests-passed + security-scan
└── develop                 # integración; ruleset: 1 aprobación + tests-passed + security-scan
    ├── feature/TICKET-123-descripcion
    ├── bugfix/TICKET-123-descripcion
    ├── hotfix/TICKET-123-descripcion      # desde master
    └── release/1.24.0
```

- **Patrón obligatorio** (lo valida `branch-naming` en CI): `(feature|bugfix|hotfix)/TICKET-123-descripcion` o `release/x.y.z`. El ticket va en mayúsculas con guion y número (`KTSS-3456`); la descripción en minúsculas y guiones.
- Los PR van contra `develop`; `release/x.y.z` se integra en `master` y se etiqueta; los hotfix salen de `master` y vuelven a `develop`.
- La rama se mantiene con `git fetch origin && git rebase origin/develop`; el ruleset descarta las aprobaciones al hacer push, así que se rebasa **antes** de pedir revisión.
- La rama se elimina al fusionar.
- Push directo a `develop` o `master`: nunca. El bypass de owner solo se usa para un hotfix con excepción registrada según la DoD §9.

---

## 4. Commits

Formato [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>(<alcance>): <descripción en imperativo, minúscula, sin punto final>

[cuerpo opcional: qué y por qué, no cómo]

[pie opcional: Closes KTSS-123, BREAKING CHANGE: ...]
```

| Tipo | Uso |
| :--- | :--- |
| `feat` | Funcionalidad nueva visible para el usuario o la API |
| `fix` | Corrección de un defecto |
| `refactor` | Cambio interno sin cambio de comportamiento |
| `perf` | Mejora de rendimiento medible |
| `test` | Solo tests |
| `docs` | Solo documentación |
| `style` | Solo formato |
| `chore` | Dependencias, build, versión, mantenimiento |

- **Alcance** = bounded context o app: `cases`, `users`, `boards`, `kace-saas`, `ci`, `deps`, `core`.
- Un commit, un propósito. Un `feat` no lleva dentro un `refactor` no relacionado.
- Ejemplos reales del repo: `fix(user-list): conservar el orden del catálogo en el selector de usuarios`, `feat(cases): display seconds and milliseconds in case event logs`, `refactor(cases): unify clearable base filter prop name`.
- Verificación: por el revisor. No hay `commitlint` (ver Guía C).

---

## 5. Pruebas

### 5.1 Pirámide real y comandos

| Capa | Herramienta | Dónde | Comando |
| :--- | :--- | :--- | :--- |
| Unitarias y de integración de dominio | Jest 29 (ESM) | `packages/kace_cloud_core/tests/<contexto>/` | `pnpm --filter @kace/core run tests` (suite completa, ~27 min con 6 workers); `pnpm run test:ctx <ruta>` para un archivo (sin `--`, que anula el filtro) |
| Migraciones | Jest + PostgreSQL | `packages/kace_cloud_database` | `pnpm --filter @kace/database run test:unit` |
| Microservicios | Jest 29 (ESM) | `apps/apiv1/*/test/*.test.mjs` | `pnpm --filter <servicio> test` |
| E2E de Lambda | Jest + SAM Local | `apps/apiv1/*/test/*E2E*.e2e.mjs` | según [E2E_API_REST_SERVICE_TEST_SPECIFICATION.md](E2E_API_REST_SERVICE_TEST_SPECIFICATION.md) |
| Unitarias de frontend | Vitest 3 + Testing Library (jsdom) | junto al archivo o `__tests__/` | `pnpm --filter ./apps/kace-saas run test` / `test:coverage` |
| E2E de frontend | **Cypress** | `src_v2/features/<feature>/e2e/<feature>.spec.js` | `pnpm --filter ./apps/kace-saas run e2e` / `e2e:open` |

CI ejecuta la suite de core en 4 shards, las de database, channel-hub, workspaces, event-processor, el E2E de interactions y el build y los tests de infraestructura del frontend; `tests-passed` resume todo y es obligatorio para fusionar. `nightly-core` corre la suite completa de core cada noche sobre `develop`.

### 5.2 TDD

1. Escribir la prueba que describe el comportamiento esperado.
2. Ejecutarla y verla fallar (Red).
3. Implementar lo mínimo para que pase (Green).
4. Refactorizar con la prueba en verde.

Toda lógica nueva tiene al menos una prueba que **falla si se revierte**. Los casos borde identificados en el ticket (vacíos, nulos, duplicados, concurrencia, timeouts, multi-tenant) tienen su prueba, no solo el camino feliz.

### 5.3 Qué se aísla y qué no

- **Unitarias**: los colaboradores se sustituyen por mocks o stubs. En ESM, `jest.unstable_mockModule` debe registrarse **antes** de importar el módulo bajo prueba, y no funciona si un barril ya cargó el módulo real.
- **Integración** (`*.integration.test.js`, repositorios, casos de uso con base): **PostgreSQL real**. Nunca SQLite (`tests/support/noSqliteInTests.test.js` lo impide) ni `jest.spyOn` sobre el repositorio. El motivo: SQLite es más permisivo y las pruebas pasaban con código que fallaba en producción.
- **Servicios de terceros** (AWS, SMTP, APIs externas): nunca reales en ningún test. Se sustituyen por adaptadores en memoria o mocks del SDK; el mock de S3 debe drenar el `Body` o el `unlinkSync` posterior falla en el test siguiente.

### 5.4 Reglas de la suite de `@kace/core`

Resumen de [tests/README.md](../../packages/kace_cloud_core/tests/README.md), que es la referencia completa:

1. Cada archivo de test tiene su **propia base PostgreSQL** clonada de una plantilla migrada y sembrada; cada `it` empieza con la base en estado de plantilla. Importar `knexConfig` de `../knexfile.js` basta.
2. **En `afterAll` no se toca la base**: ya no existe.
3. **Se esperan todas las escrituras**; una promesa sin `await` deja la base en un estado que el siguiente `it` no espera.
4. `expect(async () => ...).not.toThrow()` no espera nada; usar `await expect(...).resolves`/`.rejects`.
5. PostgreSQL devuelve `numeric` como string y ordena distinto a SQLite: afirmar sobre valores normalizados.
6. **Fixtures fieles a las FKs**: `ensureParentRow` o las `*Factory` de `src/factories/` (`CaseFactory` para `caso_id`), no `CasesMother` cuando la fila padre importa.
7. **Object Mothers** (`tests/<contexto>/domain/<Agregado>Mother.js`) para construir agregados válidos con valores aleatorios; sin `chance.last()` sin filtrar (los apóstrofes rompían la validación).
8. **Fechas**: relativas al reloj del test o congeladas con fake timers; nunca dependientes de la hora del día (a las 23:00 en `America/Bogota` ya es otro día en UTC) ni de la antigüedad de la fila `ans` sembrada en la plantilla. `TZ=America/Bogota` en CI.
9. `it.skip` solo con ticket y motivo en el propio test.
10. Si el cambio toca `packages/kace_cloud_core/src/shared`, **se corre la suite completa en local** antes de abrir el PR.

### 5.5 Estructura de un test

Patrón AAA, un comportamiento por `it`, nombre que describe el resultado esperado y la condición:

```javascript
describe('CaseBulkCloser', () => {
    it('cierra solo los casos abiertos del grupo indicado', async () => {
        // Arrange
        const open = await CasesMother.createCase(repository, { grupo_id: groupId });
        const closed = await CasesMother.createCase(repository, { grupo_id: groupId, cerrado: true });

        // Act
        const result = await new CaseBulkCloser(repository).execute({ grupo_id: groupId });

        // Assert
        expect(result.closedIds).toEqual([open.id.value]);
        expect(result.closedIds).not.toContain(closed.id.value);
    });
});
```

Sin dependencias de orden de ejecución, sin `sleep`, sin datos compartidos entre `it`.

### 5.6 E2E de frontend con Cypress

- Un spec por feature en `src_v2/features/<feature>/e2e/<feature>.spec.js`; el que genera `pnpm run kace` se completa, no se deja como placeholder.
- Selectores por `data-testid` en `kebab-case`; nunca por clase CSS ni texto traducible.
- Sesión con `cy.session` reutilizable entre specs; credenciales por variables de entorno, nunca en el repo.
- Llamadas a la API observadas con `cy.intercept`; no se depende de tiempos fijos (`cy.wait(ms)`).
- Cada flujo de usuario nuevo o modificado tiene su escenario E2E cuando cruza más de una página.

### 5.7 Cobertura

- **80 % de líneas y ramas sobre el código nuevo o modificado** en el PR, y la global del paquete no baja. No cuentan configuración, migraciones ni mocks.
- Medición vigente: `pnpm --filter @kace/core run test:coverage` (umbral global 80 % en `jest.config.js`, activo solo con `--coverage`) y `pnpm --filter ./apps/kace-saas run test:coverage`. El resumen se adjunta al PR mientras no exista job de CI (Guía C).

---

## 6. Comentarios y documentación en código

- Comentar solo cuando el código no se explica solo, y entonces explicar el **por qué**: la restricción, el incidente, el contrato externo. El **qué** lo dicen los nombres.
- JSDoc para tipos en dominio y contratos de constructor (`@type {ValueObjectUuid}`, `@param {EventPublisher} [eventPublisher]`); no hay generación de documentación a partir de JSDoc.
- `TODO` y `FIXME` solo con ticket: `// TODO(KTSS-123): ...`. ESLint avisa de los que no lo llevan.
- Exclusiones de reglas de SonarQube con comentario `// SONAR-EXC: <motivo>` en la línea afectada.
- Sin código muerto ni bloques comentados: git guarda la historia.
- Documentación externa: README del bounded context o de la feature para lo estructural; ADR (Guía A §10) para decisiones; guías A, B y C para normas. La documentación afectada se actualiza en el mismo PR.

---

## 7. Pull requests

- **Un propósito** por PR: feature, fix o refactor, no mezclados.
- **~400 líneas reales** como umbral de conversación (sin generados, lockfiles, snapshots ni formato puro). Un PR de 500 líneas coherente es preferible a tres artificiales; uno de 1 500 se divide en PRs encadenados.
- Sin archivos tocados por accidente: formateo masivo, lockfiles innecesarios, configuración local.
- Descripción, cómo probarlo, riesgos, enlace al ticket, capturas o payloads, notas de despliegue y evidencia de SonarQube local, según la [plantilla de PR](../../.github/PULL_REQUEST_TEMPLATE.md). Cada casilla está explicada con ejemplos en la [guía del checklist](pr-checklist-guide.md). El ticket de Jira recibe el enlace al PR.
- Todos los hilos de revisión se resuelven o se convierten en ticket enlazado antes de fusionar.
- Regla de cierre: si al leer tu propio diff necesitas explicar algo en voz alta al revisor, eso va en un comentario del código o en la descripción del PR.
