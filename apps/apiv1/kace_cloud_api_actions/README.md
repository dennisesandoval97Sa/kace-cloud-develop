# Arquitectura y Motor de Acciones (Actions Engine)

## 1. ¿Qué es un Action?

Conceptualmente, combina tres piezas fundamentales aplicadas sobre una entidad objetivo (`ENTITY target`):

* **TRIGGER:** Cuándo se dispara.
* **CONDITIONS:** Si se cumple o no la regla.
* **ACTION_TYPE:** Qué efecto produce.

### Regla lógica de negocio

**SI** ocurre [trigger] **Y** se cumplen [conditions] **ENTONCES** ejecuta [action\_type] sobre [entity]

---

## 2. ¿Qué la compone?

### Atributos clave

* `action_type`, `triggers`, `conditions` (almacenado como `JSONB`), `entity`, `is_active`, `priority`, `permissions`.
* Campos de parametrización del efecto: `group_id`, `responsible_id`, `template_id`, `ws_rest_flow_id`, `external_*_code`, etc.

### Componentes en detalle

#### a) Triggers (Cuándo se dispara)

* **Ubicación:** `shared/domain/enum/ActionTriggersEnum.js`
* **Ejemplos:** `crear_caso`, `editar_caso`, `cambio_estado`, `cron_job`, así como disparadores de usuario/grupo (`create_user`, `update_group`, etc.).

#### b) Conditions (Si debe ejecutarse)

* **Ubicación:** `actions/domain/QueryTranslator/`
* **Estructura:** JSON de tipo `CompositeRule` con combinadores `AND` / `OR` anidables.
* **Regla simple (`Rule.js`):** Estructurada como `{ field, operator, value, type, value_type }`.
* **Operadores (`RuleOperator.js`):** Dispone de ~20 operadores como `=`, `!=`, `<`, `contains`, `in`, `between`, `null`, etc.

#### c) Action Types (Qué efecto produce)

* **Ubicación:** `actions/domain/ActionTypes.js`
* **Asignación:** `ASIGNAR_ASESOR_EN_CURSO`, `ASIGNAR_GRUPO_EN_CURSO`, `ASIGNAR_LISTA_GRUPOS` (mediante código externo estático o dinámico).
* **Notificaciones:** `ENVIO_CORREO` (basado en plantillas).
* **Integraciones:** `CONSUMO_REST_FLOW` (ejecuta un flujo de trabajo REST externo).
* **Mutaciones:** `ACTUALIZAR_MODELO` (actualización de campos mediante fórmulas).

#### d) Entity Target

* **Ubicación:** `ValueObjectEntity`
* **Entidades soportadas:** `case`, `user`, `group`, `client`.

#### e) Permisos

* Control de acceso mediante listas de exclusión e inclusión (`whiteList` / `blackList`) de usuarios y grupos.

---

## 3. ¿Cómo se ejecutan?

Existen **tres caminos de ejecución**, pero todos convergen en el `ActionExecutor`, el cual despacha la tarea al *handler* (manejador) concreto según el `action_type`.

### A) Por evento (Inmediato)

*Se aplica para los triggers: `crear_caso`, `editar_caso` y `cambio_estado`.*

```text
CaseCreated / CaseUpdated 
  → event-processor Lambda (cases/handler.mjs)
      → ExecuteActionsOnCaseCreated / Updated
          → ActionExecutionDomainService.execute(trigger, case)   (actions/domain/ActionExecutionDomainService.js)
              ├─ FinderByTrigger → Obtiene las acciones activas vinculadas a ese trigger.
              ├─ Por cada acción: Valida las "conditions" contra el caso (directamente en memoria).
              └─ SI cumple → ActionExecutor.execute(); Recarga el caso si la acción lo mutó.

```

### B) Por cron (Planificado)

*Se aplica para el trigger `cron_job` a través del worker ECS `actions-queue-executions`.*

```text
Scheduler (croner) 
  → ActionsQueueJob.run(tenant)
      → ActionQueueExecutionsExecutor.execute()   (actions-queue-executions/application/executions/...)
          ├─ Bloqueo (lock) en background_executions (evita solapes de procesos).
          ├─ Encuentra acciones cron_job activas y las separa por tipo.
          ├─ PREFILTRO SQL:
          │    EntityCandidateFinder + ActionConditionsToSqlTranslator
          │    Traduce las conditions JSON → WHERE SQL → Set de casos candidatos.
          │    (Nota: si una regla no es traducible, hace un fallback a evaluar todos en memoria).
          ├─ Por cada candidato: RuleValidator.validate() + ActionExecutor.execute().
          └─ Registra cada ejecución finalizada en la tabla actions_queue_executions.

```

### C) Masivo (Por lote / Batch)

*Se aplica mediante un `ActionJob` cuando se requiere impactar a múltiples registros usando un filtro o archivo.*

```text
Usuario crea ActionJob (filter / s3_file) 
  → Evento: ActionJobCreated
      → event-processor (action-jobs) 
          → ProcessJobOnActionJobCreated
              → Recorre los registros del lote, valida y ejecuta la acción por cada uno de ellos.
              → Estados del flujo: PENDING → IN_PROGRESS → COMPLETED.
              → El detalle de cada fila queda asentado en action_job_processing.

```

---

## 4. Evaluación de condiciones: Dos modos

Para optimizar el rendimiento y la carga del sistema, el motor evalúa las reglas de dos maneras distintas según el contexto de la ejecución:

1. **En memoria (`RuleValidator.js`):** Evalúa el `CompositeRule` de forma recursiva directamente contra el contexto de la entidad. Este es el camino por defecto y el más rápido para los disparadores por evento inmediato (Triggers en tiempo real).
2. **Prefiltro SQL (`ActionConditionsToSqlTranslator.js` + `FieldCatalog.js` + `RuleTranslatabilityAnalyzer.js`):** Traduce el JSON de condiciones complejas a sentencias de filtrado `WHERE` nativas de SQL. Su objetivo principal es evitar la carga masiva e innecesaria de entidades en memoria durante los procesos de tipo Cron.
* *Degradación controlada (Graceful Degradation):* Si el analizador detecta que alguna regla de negocio no es traducible a código SQL, el motor degrada el proceso automáticamente y realiza la evaluación en memoria.