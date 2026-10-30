# Definition of Done (DoD)

### Equipo de Desarrollo de Software

**Versión 1.01 — Documento normativo**

---

## Control de versiones

| Versión | Fecha | Descripción | Autor(es) |
| :---- | :---- | :---- | :---- |
| 1.00 | 2025 | Creación del documento | Jose Roberto García López |
| 1.01 | 2026-09-10 | Alineación con el repositorio: guías separadas (A, B, C), herramientas reales por capa, reglas de arquitectura bloqueantes, SonarQube local, Cypress, protección de ramas verificada, pendientes actualizados | Jose Roberto García López |

**Vigente desde:** fecha de aprobación por el Tech Lead.

---

## 1\. Propósito

Este documento define **cuándo un trabajo está terminado**. No describe cómo está construido el sistema —eso está en la *Guía A, Arquitectura*—, ni cómo escribir y entregar código —*Guía B, Estilo y convenciones*—, ni con qué herramientas —*Guía C, Decisiones de tooling*—, ni cómo preparar un Pull Request —*Checklist para Pull Request*—. Define el acuerdo único, explícito y no negociable que usamos todos para decir "esto ya está".

El objetivo es eliminar la ambigüedad. Si un ticket está marcado como terminado, cualquier persona del equipo debe poder asumir, sin preguntar, que todo lo listado aquí se cumplió.

### Documentos relacionados

| Documento | Responde a | Ubicación | Versión mínima |
| :---- | :---- | :---- | :---- |
| Guía A — Arquitectura | ¿Cómo está construido el sistema y qué reglas no se negocian? | [architecture.md](architecture.md) | 1.0 |
| Guía B — Estilo y convenciones | ¿Cómo escribo, nombro, pruebo y entrego el código? | [style-and-conventions.md](style-and-conventions.md) | 1.0 |
| Guía C — Decisiones de tooling | ¿Con qué herramientas trabajamos y por qué? | [tooling-decisions.md](tooling-decisions.md) | 1.0 |
| Checklist para Pull Request | ¿Qué reviso antes de pedir revisión? | [PULL_REQUEST_TEMPLATE.md](../../.github/PULL_REQUEST_TEMPLATE.md) | 2.0 |
| DevSecOps Handbook de Konecta | Exigencias corporativas de seguridad en el ciclo de vida | [devsecops-hub.konecta.cloud](https://devsecops-hub.konecta.cloud/devsecops-handbook.html) (requiere sesión de Google) | vigente |
| Checklists de Seguridad Informática | Controles de seguridad de aplicación | [Backend](../CheckListSeguridadBackend.pdf), [Frontend](../CheckListSeguridadFrontend.pdf) | vigente |
| **Definition of Done (este documento)** | **¿Cuándo puedo cerrar el ticket?** | `docs/guides/definition-of-done.md` | — |

Cada criterio de esta DoD nombra **quién o qué lo verifica**: un job de CI, un script del repositorio o un rol. Un criterio sin verificador no entra aquí; entra en la sección 11 como decisión pendiente con dueño.

---

## 2\. Alcance y aplicación

- Aplica a **todo** el trabajo que modifica el producto: features, fixes, refactors, cambios de infraestructura, de configuración y de documentación normativa.
- Aplica por igual a backend (Node.js / AWS Lambda / API Gateway), a `@kace/core` y paquetes compartidos, a infraestructura (CDK) y a frontend (React SPA).
- **No se cierra un ticket que no cumpla la DoD.** No existe "terminado pero falta X". Si falta X, el ticket sigue abierto o X se convierte en un ticket propio, enlazado y priorizado.
- Las excepciones se gestionan como se indica en la sección 9\. No se acuerdan verbalmente.

---

## 3\. Definition of Ready (previo)

Un ticket no debería entrar a desarrollo sin esto. Se incluye porque la mitad de los incumplimientos de la DoD nacen de un ticket mal definido.

- [ ] El problema de negocio está descrito, no solo la solución técnica propuesta
- [ ] Tiene criterios de aceptación explícitos y verificables
- [ ] El alcance está acotado: se entiende qué queda **fuera**
- [ ] Las dependencias externas (otros equipos, servicios, datos, tenants afectados) están identificadas
- [ ] El lenguaje del ticket usa los términos del dominio (lenguaje ubicuo), no jerga técnica improvisada
- [ ] Es estimable y cabe razonablemente en un PR de \~400 líneas; si no, se divide antes de empezar
- [ ] Tiene identificador de ticket, porque la rama lo exige (`tipo/TICKET-123-descripcion`)

---

## 4\. Niveles de la DoD

La DoD se aplica en cuatro momentos. Cada nivel asume que el anterior se cumplió.

| Nivel | Momento | Responsable |
| :---- | :---- | :---- |
| **N1 — Desarrollo** | Antes de abrir el PR | Autor |
| **N2 — Revisión** | Antes de aprobar el PR | Revisor |
| **N3 — Historia** | Antes de mover el ticket a *Done* | Autor \+ PO/QA |
| **N4 — Incremento** | Antes de dar por liberada una versión | Tech Lead |

---

## 5\. N1 — DoD de desarrollo (antes de abrir el PR)

### 5.1 Alcance del cambio

- [ ] El cambio resuelve un solo propósito: feature, fix o refactor — no mezclados
- [ ] Está por debajo de \~400 líneas reales; si no, se dividió en PRs encadenados
- [ ] No hay archivos tocados por accidente: formateo masivo, lockfiles innecesarios, cambios de configuración local
- [ ] La rama sigue el patrón `(feature|bugfix|hotfix)/TICKET-123-descripcion` o `release/x.y.z` — *verifica: `branch-naming` en CI*
- [ ] Los commits siguen Conventional Commits (`tipo(alcance): descripción`) — *verifica: revisor (Guía B §4)*

### 5.2 Funcionalidad

- [ ] Cumple **todos** los criterios de aceptación del issue, no solo el camino feliz
- [ ] Casos borde identificados y resueltos: vacíos, nulos, duplicados, concurrencia, timeouts, multi-tenant
- [ ] Los errores se propagan con contexto útil y por el contrato público de errores; nada se traga en silencio
- [ ] Probado manualmente al menos una vez en local, con el escenario descrito en el PR

### 5.3 Diseño y arquitectura

- [ ] Se siguió el ciclo TDD: la prueba se escribió primero, falló (Red), pasó (Green) y luego se refactorizó
- [ ] La lógica de negocio vive en `domain`; la orquestación en `application`; adaptadores, persistencia y servicios externos en `infrastructure`; la infraestructura no se filtra hacia adentro
- [ ] La estructura de directorios refleja el dominio (Screaming Architecture) y el corte por funcionalidad (Vertical Slicing)
- [ ] No se duplica algo ya resuelto en `@kace/core` u otro paquete del monorepo
- [ ] Las abstracciones nuevas tienen al menos dos usos reales que las justifiquen (YAGNI)
- [ ] Los contratos públicos —API, eventos, esquemas— no rompen consumidores existentes; si el breaking change es inevitable, está documentado y versionado
- [ ] El diseño respeta SOLID, DRY, KISS, Tell-Don't-Ask y la Ley de Demeter en la medida en que aplique al cambio
- [ ] **Backend:** cumple las reglas bloqueantes de la Guía A — *verifica: revisor*:
  - solo `GET`, `POST` y `OPTIONS`; escrituras como `POST` sobre subrecurso
  - un controlador por endpoint; `handler.mjs` termina siempre en `controller.run()`; permisos por ruta, nunca por `httpMethod`
  - todo handler bajo `withTenantContext`; `knexConfig` es configuración, no una instancia de Knex; nada de `process.env` para configuración por tenant
  - todo repositorio extiende `KnexRepository` y recibe objetos de configuración; lecturas por `this.read`, escrituras por `this.table()`
  - SQL crudo con valores como bindings e identificadores contra allowlist
  - PostgreSQL es el único motor: sin ramas `sqlite3`
  - sin *barrel files*: imports directos al módulo
  - handlers de eventos en `@kace/core/src/<contexto>/application/event-handlers/`, nombre `<Verbo>On<Evento>`, `handle(domainEvent)` de un argumento
- [ ] **Frontend:** cumple las reglas de la Guía A §8 — *verifica: revisor*:
  - módulo nuevo en `src_v2/features/<feature>/`, creado con `pnpm run kace -- <feature>`; no se crean páginas nuevas en `src/pages/`
  - los componentes no llaman a Axios: solo a hooks; todo dato de servidor pasa por TanStack Query desde un hook
  - Redux Toolkit guarda solo estado de UI y sesión
  - toda validación de formulario es un esquema Joi con React Hook Form

### 5.4 Pruebas

- [ ] Existen tests que **fallan si se revierte la lógica nueva**
- [ ] Cubren los casos borde listados arriba, no solo el happy path
- [ ] Unitarios: colaboradores aislados con mocks. Integración (`*Integration.test.js`, repositorios): PostgreSQL de pruebas real, nunca SQLite ni mocks del repositorio. Ningún test llama a servicios de terceros (AWS, SMTP, APIs externas)
- [ ] Sin dependencias frágiles: fechas relativas o congeladas con fake timers (nunca dependientes de la hora del día ni de la antigüedad de la plantilla), sin orden de ejecución, sin `sleep`
- [ ] Herramienta según la capa (Guía B §5): Jest en backend y `@kace/core`; Vitest en frontend; **Cypress** para E2E de frontend cuando el cambio afecta un flujo completo de usuario, con `data-testid` y spec en `src_v2/features/<feature>/e2e/`; Jest \+ SAM Local para E2E de Lambdas
- [ ] Los tests del **paquete tocado** pasan en local; la suite completa la ejecuta CI — *verifica: `tests-passed` en verde*
- [ ] **Si el cambio toca `@kace/core/src/shared`, la suite completa de core se corrió en local** (`pnpm --filter @kace/core run tests`) antes de abrir el PR — *verifica: autor, lo declara en el PR*
- [ ] Cobertura de código no menor al **80 %** sobre el código nuevo o modificado, y la global del paquete no baja — ver sección 10 para la medida y el verificador vigente
- [ ] Cadenas visibles nuevas en `en.json` y `es.json` — *verifica: `validate-translations`*

### 5.5 Seguridad

- [ ] Todo input externo se valida en el borde con Joi (`schemas.mjs` en backend; React Hook Form \+ Joi en frontend), no dentro del dominio
- [ ] La autorización se verifica **por recurso**: identificadores del cuerpo mediante `ObjectIdentityAuthorization`; endpoints de búsqueda cubiertos — *verifica: `pnpm run search-auth:check`*
- [ ] Sin secretos en el código; los logs no exponen datos sensibles (PII, tokens, credenciales) — *verifica: `security-scan` (Trivy secretos, bloqueante)*
- [ ] Sin consultas N+1 ni listados sin paginación
- [ ] El código cumple los checklists de Seguridad Informática de `docs/` (backend y frontend)
- [ ] **Escaneo SonarQube ejecutado en local** con el `sonar.sh` del paquete tocado: sin issues Blocker ni Critical nuevos, sin vulnerabilidades de cualquier severidad; toda exclusión de regla en código lleva `// SONAR-EXC: <motivo>` — *verifica: autor adjunta enlace o captura del proyecto `KCRM_KACE_CLOUD_<módulo>_<versión>` en el PR; revisor lo comprueba*
- [ ] `security-scan` en verde: sin CVE Critical/High nuevos; ninguna entrada nueva en `.trivyignore` sin motivo, alcance, responsable y fecha de caducidad — *verifica: CI*

### 5.6 Base de datos

- [ ] Los cambios de esquema se hacen mediante migraciones de **Knex**, nunca por script manual ni cambio directo
- [ ] Las migraciones son **reversibles** y están probadas hacia abajo (`rollback`), no solo hacia arriba — *verifica: `test-database` en CI*
- [ ] Son compatibles con la versión anterior desplegada del código (expand/contract; despliegue en dos fases si es necesario)
- [ ] Probadas sobre una copia con datos representativos, no sobre una base vacía
- [ ] Las migraciones **nuevas** declaran tipo y longitud solo cuando es estrictamente necesario y no usan `notNullable` ni `defaultTo`: las restricciones de negocio viven en los Value Objects del agregado. Excepciones técnicas que sí van en la base: claves primarias, claves foráneas, índices únicos parciales y `deleted_at` — *verifica: revisor sobre el diff de `migrations/`*
- [ ] PostgreSQL único: `table.jsonb()` directo, sin ramas por cliente de base de datos
- [ ] Toda FK por la que se filtra lleva índice explícito (`table.foreign()` no lo crea en PostgreSQL); las tablas `history_*` nuevas indexan `entity_id`
- [ ] El DDL ejecutado en runtime desde un repositorio va cualificado con `withSchema(this.schema)`; las migraciones corren con el `searchPath` del tenant y no se cualifican a mano

### 5.7 Infraestructura y despliegue

- [ ] Variable de entorno nueva → declarada en `.env.example` — *verifica: `validate:env:deploy`; el hook `pre-push` ya corre `validate:env`*
- [ ] Stack que publica eventos → llama a `grantEventPublishingPermissions` y su cola está en `perBcArns`
- [ ] Cola nueva → ARN en el IAM del deploy **y** URL en el tenant (DynamoDB); una sola URL ausente hace que el bus del tenant caiga a memoria y pierda todos los eventos
- [ ] Stack construido a mano (sin `setDefaultOptions`) → cablea `DB_TARGET`
- [ ] `cdk:synth` del servicio tocado pasa en local

### 5.8 Higiene

- [ ] Sin código muerto, `console.*`, ni TODOs sin ticket asociado — *verifica: ESLint (`no-console`, `no-warning-comments`)*
- [ ] Nombres que revelan intención; los comentarios explican el **por qué**, no el qué
- [ ] Se respetan las convenciones de nomenclatura de la Guía B §2: `camelCase` (variables y funciones), `PascalCase` (clases, componentes React), `UPPER_SNAKE_CASE` (constantes), `snake_case` (propiedades de agregados, porque reflejan columnas), `kebab-case` (directorios nuevos), casos de uso `[Entidad][Acción]`
- [ ] Formato de la Guía B §1: 4 espacios, comillas simples, punto y coma, coma final ES5, 120 columnas — *verifica: Prettier en el hook `pre-commit` y en el job `lint` de CI*
- [ ] ESLint del paquete tocado sin errores (`eslint-check` en apps; en `packages/`, `prettier --check` mientras ESLint no esté cableado), `tsc` en verde en los stacks CDK, y el build de la app pasa — *verifica: autor en local; ver sección 11 para ESLint en CI*
- [ ] Dependencias nuevas justificadas en la descripción: por qué esta y no la que ya está; sin CVE Critical/High — *verifica: `security-scan`*

---

## 6\. N2 — DoD de revisión (antes de aprobar el PR)

### 6.1 Qué se entrega junto al PR

El PR no está listo para revisión si le falta alguno de estos elementos. Se completan en la plantilla de PR del repositorio (`.github/PULL_REQUEST_TEMPLATE.md`); el ticket de Jira recibe el enlace al PR.

- [ ] **Descripción**: qué problema resuelve y por qué se eligió este enfoque
- [ ] **Cómo probarlo**: pasos concretos o comando para reproducir el escenario
- [ ] **Riesgos**: qué puede romperse, qué queda fuera de alcance, qué necesita seguimiento
- [ ] **Enlace al ticket** y, si aplica, a la decisión de diseño o ADR
- [ ] **Capturas o payloads de ejemplo** si hay cambios visibles o de contrato
- [ ] **Notas de despliegue**: variables de entorno nuevas, orden de migraciones, colas y permisos, feature flags
- [ ] **Enlace o captura del escaneo SonarQube local** del paquete tocado
- [ ] **Checklist para Pull Request** completado en la plantilla

### 6.2 Qué verifica el revisor

- [ ] Al menos **un revisor** distinto del autor aprobó el cambio — *verifica: ruleset `develop-protection` (1 aprobación, se descarta al hacer push, hilos resueltos)*
- [ ] **Dos aprobaciones** si el cambio toca contratos públicos, seguridad, autorización o migraciones — *verifica: revisor y Tech Lead; el ruleset solo exige una, así que el autor solicita la segunda explícitamente en el PR*
- [ ] El bypass de owner del ruleset solo se usa para hotfix con excepción registrada según la sección 9
- [ ] Todos los comentarios están resueltos o convertidos en tickets enlazados — ninguno queda "para después" sin registro
- [ ] CI en verde: `tests-passed` y `security-scan` (exigidos por el ruleset), `branch-naming` y, si se tocaron workflows, `pin-lint`
- [ ] El revisor entendió el diff **sin necesidad de preguntarle al autor**

### 6.3 Regla de cierre

> Si al leer tu propio diff necesitas explicar algo en voz alta al revisor, eso debería estar en un comentario del código o en la descripción del PR. El revisor no debería tener que preguntarte para entenderlo.

---

## 7\. N3 — DoD de la historia (antes de mover el ticket a *Done*)

- [ ] El PR está integrado a `develop` y la rama de trabajo fue eliminada
- [ ] El cambio está desplegado en el ambiente de pruebas correspondiente
- [ ] Los criterios de aceptación fueron **verificados en ese ambiente**, no solo en local
- [ ] Quien validó no es quien desarrolló
- [ ] Las migraciones se ejecutaron correctamente en ese ambiente y el `rollback` se probó al menos una vez fuera de local
- [ ] Las variables de entorno, colas, permisos IAM y `DB_TARGET` nuevos están configurados en ese ambiente y en cada tenant afectado
- [ ] Los feature flags están en el estado que corresponde y documentados
- [ ] La documentación afectada quedó actualizada: contratos de API, README del módulo, ADR si hubo decisión de diseño relevante, guías A/B/C si cambió una norma
- [ ] El ticket de Jira refleja el estado real: PR enlazado, comentarios de contexto para quien lo lea en seis meses
- [ ] La deuda técnica detectada durante el trabajo quedó registrada como ticket, no como comentario en el código

---

## 8\. N4 — DoD del incremento (antes de dar por liberada una versión)

- [ ] Todas las historias incluidas cumplen N3
- [ ] La rama `release/x.y.z` se integró a `master` con las **dos aprobaciones** que exige su protección, y la versión de los paquetes se subió (`version:minor` / `version:patch`)
- [ ] El despliegue a producción se completó con `pnpm deploy` sin intervención manual no documentada; `validate-env-deploy.sh` pasó en cada cuenta
- [ ] Las migraciones de producción se ejecutaron en el orden declarado y son reversibles
- [ ] Se verificó el funcionamiento en producción con al menos un escenario real por historia (smoke test)
- [ ] Los logs y métricas del periodo posterior al despliegue no muestran errores nuevos atribuibles al cambio (CloudWatch de los Lambdas tocados, `KnexTimeout`, throttles de colas)
- [ ] Existe un plan de reversión conocido y ejecutable
- [ ] Las notas de versión están publicadas y comunicadas a los interesados

---

## 9\. Excepciones y deuda técnica

La DoD es un piso, no una aspiración. Aun así, habrá casos justificados —un hotfix crítico, una dependencia externa bloqueada—. En esos casos:

1. La excepción la autoriza el **Tech Lead**, no el propio autor.
2. Se registra **por escrito en el ticket y en el PR**: qué criterio se omite, por qué, y qué riesgo se asume.
3. Se crea de inmediato el ticket de remediación, enlazado al original y con prioridad asignada.
4. Un ticket con excepción abierta no cuenta como *Done* para efectos de métricas de calidad.
5. Las excepciones al gate de vulnerabilidades siguen además el formato de `.trivyignore` y los plazos del DevSecOps Handbook §3.7 (Critical 48 h, High 14 d, Medium 45 d, Low siguiente release).

Una excepción que se repite deja de ser excepción: es una señal de que la DoD debe cambiar. Ese cambio se discute en retrospectiva y se refleja en una nueva versión de este documento.

---

## 10\. Criterios de medición

Para evitar interpretaciones distintas de los criterios cuantitativos:

**Cobertura del 80 %.** Se mide sobre **líneas y ramas del código nuevo o modificado** en el PR. Adicionalmente, la cobertura global del paquete tocado no debe **disminuir** respecto a `develop`. No se computan como cubiertos los archivos de configuración, migraciones ni mocks. *Verificador vigente:* mientras no exista un job de CI, el autor adjunta al PR el resumen de `test:coverage` del paquete tocado (Jest en core y apis, Vitest en frontend). El umbral configurado hoy en `@kace/core` es 80 % global y solo se activa con `--coverage`.

**\~400 líneas.** Cuenta líneas reales de código añadidas o modificadas. No cuentan archivos generados, lockfiles, snapshots ni cambios de formato puro. Es un umbral de conversación, no un límite duro: un PR de 500 líneas coherente es preferible a tres PRs artificiales.

**Análisis estático.** SonarQube en local con el `sonar.sh` del paquete: el PR no puede introducir issues de severidad *Blocker* o *Critical*, ni vulnerabilidades de cualquier severidad, en el proyecto `KCRM_KACE_CLOUD_<módulo>_<versión>`.

**Análisis de dependencias.** El PR no puede introducir secretos ni vulnerabilidades de dependencias de severidad Critical o High (`security-scan`). Medium y Low se registran y se resuelven dentro de los plazos del Handbook §3.7.

---

## 11\. Puntos pendientes de definir

Estos temas están abiertos y se cerrarán en una versión posterior de este documento. Mientras tanto, aplica el criterio del Tech Lead. Cada uno tiene dueño y se registra en la Guía C.

| Tema | Estado | Qué falta |
| :---- | :---- | :---- |
| SonarQube en CI | Abierto | Instancia dedicada que permita ejecutar el escaneo en CI, con fecha objetivo. Unificar los 105 `sonar.sh` (host, prefijo de proyecto y exclusiones difieren) en un script único parametrizado por paquete. |
| Medidor de cobertura | Abierto | Job de CI que mida cobertura sobre el diff y umbral por paquete en Vitest. Hasta entonces, resumen manual en el PR (sección 10). |
| ESLint en CI | Abierto | El job `lint` solo corre Prettier sobre archivos cambiados; `packages/` no tiene ESLint cableado. |
| Observabilidad | Abierto | Estándar mínimo de logs estructurados, correlación de peticiones y alertas para Lambdas; hoy solo CloudWatch y `EventLogger`. |
| Ambientes | Abierto | Formalizar nombres (`APPS_ENVIRONMENT`, prefijos de stack, cuentas por cliente), propósito y ruta de promoción. |
| ADR | Casi cerrado | Existen plantilla y 23 registros en dos carpetas; consolidar en `docs/architecture/adr/`. |

Resueltos desde la v1.00 y retirados de esta lista: convención de commits y de ramas (Guía B; la de ramas la bloquea CI), política DevSecOps (enlazada), checklist de seguridad (PDF de `docs/`), herramientas de prueba por capa (Guía B §5).

---

## 12\. Vigencia

Este documento entra en vigor a partir de su publicación y aplica a todo trabajo iniciado después de esa fecha. Se revisa en cada retrospectiva de cierre de ciclo y cada vez que una de las guías A, B o C sube de versión mayor. Cualquier integrante del equipo puede proponer un cambio; la aprobación corresponde al Tech Lead.
