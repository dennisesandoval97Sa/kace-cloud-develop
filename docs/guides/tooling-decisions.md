# Guía C — Decisiones de tooling

**Versión 1.00 — Documento normativo**

| Versión | Fecha | Descripción | Autor(es) |
| :---- | :---- | :---- | :---- |
| 1.00 | 2026-09-10 | Creación. Recoge las herramientas vigentes, las que están en evaluación y las retiradas | Jose Roberto García López |

**Vigente desde:** fecha de aprobación por el Tech Lead.

Responde a: *¿con qué herramientas trabajamos y por qué?*

Documentos hermanos: [Guía A — Arquitectura](architecture.md) · [Guía B — Estilo y convenciones](style-and-conventions.md) · [Definition of Done](definition-of-done.md) · [DevSecOps Handbook de Konecta](https://devsecops-hub.konecta.cloud/devsecops-handbook.html) (requiere sesión de Google).

Cada decisión tiene un **estado**: **Vigente** (se usa y se exige), **En evaluación** (se usa parcialmente o falta decidir algo, con dueño y fecha objetivo), **Retirada** (no se usa; el código que quede se elimina, no se amplía). Cambiar el estado de una fila exige subir la versión de esta guía y, si afecta a un criterio de la DoD, la versión menor de la DoD.

---

## 1. Resumen

| Área | Decisión | Estado |
| :--- | :--- | :--- |
| Runtime y gestor | Node 22, pnpm 10 workspaces, `--frozen-lockfile` | Vigente |
| Infraestructura | AWS CDK 2.x; SAM Local para desarrollo; `pnpm deploy` con `validate-env-deploy.sh` | Vigente |
| Base de datos | PostgreSQL 16 (Aurora + RDS Proxy), Knex 3; SQLite | Vigente / **Retirada** (SQLite) |
| Validación | Joi 17 en backend y frontend | Vigente |
| Formato y lint | Prettier `@kace/prettier_config`; ESLint `@kace/eslint-config` | Vigente; ESLint en CI **en evaluación** |
| Tests | Jest 29 (backend, ESM); Vitest 3 (frontend); **Cypress** (E2E frontend); Jest + SAM Local (E2E Lambda) | Vigente |
| Cobertura | 80 % sobre código nuevo; medición manual en el PR | **En evaluación**: job de CI |
| CI/CD | GitHub Actions (`ci.yml`, `branch-naming.yml`, `pin-lint.yml`, `nightly-core.yml`) | Vigente; Bitbucket Pipelines **Retirada** |
| Protección de ramas | Ruleset `develop-protection`; protección clásica en `master` | Vigente |
| Seguridad de dependencias | Trivy (secretos y CVE Critical/High bloqueantes), SBOM CycloneDX, `.trivyignore` con caducidad | Vigente |
| Análisis estático | SonarQube **en local** con `sonar.sh` por paquete | Vigente en local; CI **en evaluación** |
| Logging y observabilidad | CloudWatch por Lambda; `EventLogger` de dominio | **En evaluación** |
| Ambientes | `APPS_ENVIRONMENT` y cuentas por cliente | **En evaluación** |
| Documentación | Markdown en `docs/`, guías en `docs/guides/`, ADR en `docs/architecture/adr/`, C4 | Vigente |
| Revisión de código | Revisión asistida por agente antes de la humana, con [Code Review Agent Guide](../Code%20Review%20Agent%20Guide.md) | Vigente |
| Frontend | React 18, Vite 6, Redux Toolkit 2 (UI), TanStack Query 5 (servidor), React Router 6, Tailwind 3, Radix UI, i18next; generador `pnpm run kace` | Vigente |
| Pruebas de carga | k6 en `@kace/perf` | Vigente |

---

## 2. Runtime y gestor de paquetes

- **Node ≥ 22.16** y **pnpm ≥ 10.11** (`engines` y `packageManager` del `package.json` raíz). El lockfile es la verdad: `pnpm install --frozen-lockfile` en CI y en `pnpm deploy`.
- Versiones y parches de dependencias transitivas se fijan en el bloque `overrides` de `pnpm-workspace.yaml`; es el mecanismo para cerrar CVE cuando el paquete directo no ha publicado versión.
- `@kace/core` declara `jsonwebtoken`, `knex`, `pg` como dependencias del consumidor por hoisting: no se eliminan del `package.json` de un microservicio aunque no se importen directamente.

## 3. Infraestructura como código

- **AWS CDK 2.x** (`aws-cdk-lib ^2.185`). Cada microservicio tiene `bin/` y `lib/<name>-stack.ts`; los que usan `KApiStack` heredan CORS `GET, POST, OPTIONS`, `DB_TARGET`, `SQL_GUARD_MODE` y los permisos de publicación. Los stacks construidos a mano (`cases-stack.ts`, `users-stack.ts`) cablean esas variables con `addEnvironment`.
- **Despliegue**: `pnpm deploy` valida `.env` con `utils/bash/validate-env-deploy.sh`, instala con lockfile congelado, ejecuta `cdk:deploy` en los 95 servicios y limpia `cdk.out`. Variantes: `deploy:apis`, `deploy:frontend`, `deploy:migrations`. Guía completa en [DEPLOYMENT.md](../DEPLOYMENT.md).
- **`.env.example` es el contrato del despliegue**: cada clave no comentada la exige el validador y frena el deploy; el hook `pre-push` ejecuta `validate:env`. Una variable nueva se añade ahí en el mismo PR que la usa.
- **SAM Local** (`pnpm run api` en el microservicio) para probar un Lambda con Docker; `@kace/local-server` para levantar el conjunto en local.
- **Aurora PostgreSQL + RDS Proxy** en `@kace/aws-database` (rama lista, sin desplegar en producción a fecha de esta guía). Las métricas de latencia del proxy están en microsegundos; `CommitLatency` en milisegundos.

## 4. Base de datos

- **PostgreSQL 16** único motor; **Knex 3** como query builder y sistema de migraciones (`@kace/database`). SQLite **retirado**: no se añaden ramas ni pruebas sobre él (Guía A §6.3).
- Lectura/escritura: `DB_TARGET=primary|reader` por servicio; 51 servicios leen de réplica y 20 tienen prioridad en primario. `pg` cae en silencio al puerto 5432 si `*_PORT` no es numérico: revisar el `.env` antes de culpar a la red.
- `@kace/db-sync` sincroniza tablas entre bases PostgreSQL para pruebas y migraciones de datos.
- Acceso a bases de clientes por bastión (`ssh bastion-<cliente>`); las credenciales viven en `.env.<cliente>`, nunca en el repo.

## 5. Validación

- **Joi 17** en `schemas.mjs` de cada microservicio y en `src/schemas/` del frontend (con React Hook Form). `@kace/schemabuilder` construye validadores dinámicos a partir de los esquemas auxiliares definidos por el tenant; su `build()` está memoizado por contenido.
- Contrato de errores públicos en `@kace/error-codes` (ADR-005 y ADR-020).

## 6. Formato y lint

- **Prettier** (`@kace/prettier_config`): 4 espacios, comillas simples, punto y coma, coma final ES5, 120 columnas. Hook `pre-commit` (`pnpm run prettier`) y job `lint` de CI sobre los archivos cambiados.
- **ESLint** (`@kace/eslint-config`: base `standard` + reglas propias, `no-console: error`). Cableado en `apps/apiv1/*` y `apps/kace-saas` (`eslint-check`); **no** en `packages/`. **En evaluación**: job de ESLint en CI y configuración para `packages/`. Dueño: Tech Lead. Mientras tanto, `packages/` se verifica con `prettier --check` y el revisor.
- No hay `commitlint`; el formato de commits (Guía B §4) lo verifica el revisor. **En evaluación** añadirlo como hook `commit-msg`.

## 7. Tests

| Capa | Herramienta | Notas |
| :--- | :--- | :--- |
| Backend y `@kace/core` | **Jest 29** con ESM (`--experimental-vm-modules`) | Suite de core: una base PostgreSQL por archivo clonada de plantilla; `maxWorkers=6` en local (no subir a 10), 4 shards × 2 workers en CI. `runInBand` y `ALLOW_SCHEMA_RESET` están obsoletos |
| Migraciones | Jest + PostgreSQL | `test-database` en CI |
| E2E de Lambda | Jest + **SAM Local** (Docker) | [E2E_API_REST_SERVICE_TEST_SPECIFICATION.md](E2E_API_REST_SERVICE_TEST_SPECIFICATION.md) |
| Frontend unitario | **Vitest 3** + Testing Library, jsdom, `vitest.setup.js` | `test:coverage` con el proveedor por defecto |
| Frontend E2E | **Cypress** | Specs en `src_v2/features/<feature>/e2e/`; los genera `pnpm run kace`. Configuración en `apps/kace-saas/cypress.config.js`; scripts `e2e` y `e2e:open` |
| Carga | **k6** en `@kace/perf` | Escenarios, anonimización, pool de tokens y reportes; las APIs de cliente están tras WAF IPv4: forzar `--dns policy=onlyIPv4` |

**Cobertura — en evaluación.** Umbral 80 % global en `jest.config.js` de core (solo con `--coverage`); Vitest sin umbral; ningún job de CI la mide. Decisión pendiente: job de CI con cobertura sobre el diff y umbral por paquete en Vitest. Mientras tanto, el autor adjunta al PR el resumen de `test:coverage` del paquete tocado. Dueño: Tech Lead.

## 8. CI/CD

**GitHub Actions** desde agosto de 2026. Bitbucket Pipelines está **retirado**: los `bitbucket-pipelines.yml` que quedan en paquetes y la sección correspondiente de `DEPLOYMENT.md` se eliminan.

| Workflow | Qué hace | Bloquea |
| :--- | :--- | :--- |
| `ci.yml › lint` | Prettier sobre archivos cambiados | Sí (vía `tests-passed`) |
| `ci.yml › test-core` | Suite de `@kace/core` en 4 shards con PostgreSQL 16 y `TZ=America/Bogota` | Sí |
| `ci.yml › test-database` | Tests unitarios y de migración | Sí |
| `ci.yml › test-channel-hub-apis` | channel-hub (con cobertura), workspaces, event-processor | Sí |
| `ci.yml › test-api-interactions-e2e` | E2E de interactions contra PostgreSQL | Sí |
| `ci.yml › test-saas` | Build del frontend y tests de infraestructura (CSP) | Sí |
| `ci.yml › tests-passed` | Check único para la protección de ramas | Sí (ruleset) |
| `ci.yml › security-scan` | Trivy secretos, Trivy CVE Critical/High, SBOM CycloneDX | Sí (ruleset) |
| `branch-naming.yml` | Patrón de rama §5.2 del Handbook | Sí |
| `pin-lint.yml` | Actions pineadas por SHA (§6.3) | Sí, cuando cambian workflows |
| `nightly-core.yml` | Suite completa de core sobre `develop` cada noche | No |

Los runners tienen 2 vCPU y 7 GB: la suite de core no cabe en un solo job; por eso los shards. `scripts/ci/ci.env` provee el entorno sintético que los tests de tenant necesitan.

## 9. Protección de ramas

- **`develop`**: ruleset `develop-protection` (activo desde 2026-08-11). 1 aprobación, se descartan las aprobaciones al hacer push, hilos de revisión resueltos, aprobación extra para cambios no atribuidos, checks `tests-passed` y `security-scan` estrictos, sin borrado ni force-push. Consultar con `gh api repos/colombia-it-desarrollo/kace-cloud/rules/branches/develop` (el endpoint clásico devuelve 404 y no significa desprotegida).
- **`master`**: protección clásica. 2 aprobaciones, mismos checks, `enforce_admins`.
- La **segunda aprobación** para cambios de contratos públicos, seguridad, autorización o migraciones es regla de equipo (DoD §6.2), verificada por el revisor y el Tech Lead; el ruleset no la exige y no se usa `CODEOWNERS`.

## 10. Seguridad de dependencias

- **Trivy 0.73** instalado por versión y checksum en el job `security-scan`. Gate de secretos bloqueante; gate de vulnerabilidades Critical/High bloqueante desde 2026-08-24; SBOM CycloneDX publicado como artefacto (90 días).
- **Excepciones** solo en `.trivyignore`, cada una con motivo, alcance, responsable y `exp:AAAA-MM-DD`. Plazos del Handbook §3.7: Critical 48 h, High 14 d, Medium 45 d, Low siguiente release. Al vencer, Trivy vuelve a bloquear.
- Imágenes Docker pineadas por digest; actions por SHA.

## 11. Análisis estático: SonarQube

**Vigente en local.** Cada paquete tiene un `sonar.sh` que ejecuta el scanner en Docker contra el SonarQube interno:

| Parámetro | Valor |
| :--- | :--- |
| Scanner | `sonarsource/sonar-scanner-cli:11.1` |
| Servidor | `http://172.20.73.175:9000/` (red interna) |
| Proyecto | `KCRM_KACE_CLOUD_<módulo>_<versión>` (`version` del `package.json`) |
| Exclusiones | `cdk.out/**,node_modules/**,test/**` (frontend: `dist/**` en lugar de `cdk.out/**`) |
| Token | Se pide por consola; nunca en el repo |

Uso: `cd <paquete> && ./sonar.sh`, y adjuntar al PR el enlace o captura del proyecto. Criterio: sin issues Blocker ni Critical nuevos, sin vulnerabilidades de cualquier severidad. Las exclusiones de regla en código llevan `// SONAR-EXC: <motivo>`.

**En evaluación**: instancia dedicada que permita ejecutar el escaneo en CI con quality gate, con fecha objetivo. Pendiente de corrección en el repo: unificar los 105 scripts, porque el de la raíz apunta a `172.20.73.49`, los de `@kace/core` y `@kace/database` usan el prefijo `KCRM_test_` y las exclusiones difieren (`test/**`, `tests/**`, `dist/**`). Propuesta: un único `scripts/sonar.sh` parametrizado por paquete y un `sonar-project.properties` por paquete. Dueño: Tech Lead.

## 12. Logging y observabilidad

**En evaluación.** Hoy: logs de CloudWatch por Lambda (algunos con log group propio, como `cases`), `EventLogger` en `@kace/core/src/shared` para trazas de dominio, `SearchAuditLogger` para auditoría de búsquedas, y `no-console` en ESLint. No hay logger estructurado, ni correlación de peticiones, ni alertas estandarizadas. Decisión pendiente: formato JSON con `tenant`, `requestId` y `eventName`, y alertas mínimas por Lambda (errores, `KnexTimeout`, throttles de colas). Dueño: Tech Lead.

## 13. Ambientes

**En evaluación.** Hoy: `APPS_ENVIRONMENT` en `.env` decide prefijo de stack (`DEVELOPMENT…`) y configuración; cada cliente tiene cuenta AWS propia con su `.env.<cliente>`. Decisión pendiente: nombres formales de ambientes, propósito de cada uno y ruta de promoción `develop → release → master → cuentas de cliente`. Dueño: Tech Lead.

## 14. Documentación

- Markdown en `docs/`; las normas en `docs/guides/` (esta guía, A, B y la DoD); arquitectura en `docs/ARCHITECTURE.md` y C4 en `docs/architecture/`; eventos en `docs/events/`; frontend en `docs/frontend/README.md`.
- **ADR** en `docs/architecture/adr/` con su índice; `docs/adr/` se consolida allí (Guía A §10).
- `docs/guia_lineamientos_y_convenciones.md` y las secciones de convenciones de `docs/CONTRIBUTING.md` se reducen a un índice que apunta a estas guías. Google Docs, si se mantiene por exigencia corporativa, contiene solo el enlace al archivo del repo y al commit de la versión publicada.

## 15. Revisión de código

Revisión asistida por agente con la [Code Review Agent Guide](../Code%20Review%20Agent%20Guide.md) y su [plantilla de informe](../Code%20Review%20Report%20Template.md) antes de la revisión humana; los informes por rama quedan fuera del repo. La revisión humana aplica la DoD N2.

## 16. Frontend

React 18.3, Vite 6, Redux Toolkit 2.3 (solo UI), TanStack Query 5 (servidor), React Router 6, Tailwind 3, Radix UI, React Hook Form 7 + Joi, Axios, i18next; generador de features `pnpm run kace -- <feature>` (crea `src_v2/features/<feature>` con páginas, hooks, servicio, esquema, tests Vitest y spec Cypress). `pnpm run validate-translations` verifica `en.json`/`es.json`; `pnpm run build:analyze` inspecciona el bundle.
