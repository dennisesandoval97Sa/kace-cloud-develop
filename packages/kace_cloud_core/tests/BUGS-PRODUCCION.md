# Bugs de producción encontrados al escribir los tests de cobertura

Los veintiséis salieron entre agosto de 2026 mientras se subía la cobertura de ramas de
`@kace/core` del 72,02% al 82,05%. **Ninguno está corregido**: el plan de esa rama prohibía
tocar `src/`, así que cada uno quedó documentado con un test que fija el comportamiento
*observado*, no el pretendido. Ese test es la reproducción: al arreglar el bug hay que
esperar que falle y actualizarlo.

Cada entrada apunta al test que lo documenta, donde está la explicación larga.

---

## Críticos — pérdida o corrupción de datos

### 1. Borrar un email con adjuntos deja la base de datos a medias
`src/emails/application/delete/EmailDeleter.js` · test: `tests/emails/EmailsIntegration.test.js:499`

`KnexEmailAttachmentRepository.findByEmailId()` devuelve filas crudas de Knex, sin envolverlas
en la entidad de dominio — a diferencia de `findByEmailBodyId()`, que sí lo hace. `EmailDeleter`
da por hecho que son entidades y llama `att.delete(dto)`, así que **borrar cualquier email que
todavía tenga adjuntos lanza `TypeError: att.delete is not a function`**. Como `#execute()` no
está envuelto en ninguna transacción, el borrado lógico del email y de su cuerpo, que ya se han
ejecutado, **no se deshacen**: quedan borrados con sus adjuntos intactos.

### 2. El historial de mappers y adapters no se registra nunca
`src/shared/infrastructure/persistence/KnexRepository.js:233` · tests: `tests/rabbitmq/application/{create,update,delete}/*.test.js` (6 sitios)

`saveHistory` asume un `AggregateRoot`: llama `aggregate.toJson()` y lee `aggregate.changedAttributes`.
Ni `Mapper` ni `AdapterSettings` extienden `AggregateRoot`, y los deleters/updaters le pasan
además objetos planos como `{ id, deleted: true }`. La llamada revienta con
`TypeError: aggregate.toJson is not a function` en los seis casos, y **el `try/catch` de cada
caso de uso se lo traga en silencio** (solo `Helper.logError`). El resultado: crear, actualizar
o borrar un mapper o un adapter parece funcionar, pero no deja rastro en el historial.

### 3. Una importación CSV reanudada no llega nunca a `completed`
`src/imports/domain/services/CsvRecordProcessorService.js` · test: `tests/imports/CsvRecordProcessorServiceIntegration.test.js:207`

La rama final compara `totalRecordsInserted` —los registros tratados en *esta* llamada, es decir
solo el tramo posterior a `processed_records`— contra `records.length`, la longitud de la lista
*completa*, en vez de contra `recordsToProcess.length`. Al reanudar con desplazamiento y terminar
el tramo sin errores, no se cumple ninguna de las tres ramas de estado: la función devuelve
`undefined` y, como la llamada inicial a `updateImport` tampoco toca `status`, **la importación
se queda con su estado anterior para siempre**.

### 4. Dos setters de `User` guardan el nombre del campo en lugar del valor
`src/users/domain/User.js:190` y el equivalente de `cognito_hash_data` · test: `tests/users/domain/User.test.js:236` y `:257`

`set session_id` construye `new ValueObjectSessionId('session_id', value)`, pero ese objeto de
valor recibe `(value, nullable)`, no `(field, value)` como casi todos los demás. Guarda por tanto
el literal `'session_id'` como valor y usa el valor real como bandera `nullable`. `changedAttributes`
sí registra lo correcto —viene de la asignación directa—, pero **`user.session_id.value` nunca
refleja lo que se asignó**. Es corrupción silenciosa, no pérdida. Mismo defecto en `cognito_hash_data`.

### 5. Ninguna cuenta SERVICE puede autenticarse
`src/users/application/auth/Login.js` · test: `tests/users/application/auth/Login.test.js:35`

La comprobación de contraseña para cuentas SERVICE evalúa `user.password.value`, pero `User` **no
define ningún getter `password`**: `user.password` es siempre `undefined` y el acceso lanza
`TypeError` antes de que `compareHash` llegue a ejecutarse. Todo intento de login con una cuenta
SERVICE revienta en vez de validar o rechazar la contraseña. Pasó desapercibido porque el test que
lo cubría está en `skip` sin motivo y el único activo comprueba `rejects.toThrow(Error)` genérico,
que este `TypeError` también satisface.

---

## Altos — funcionalidad rota o código inalcanzable

### 6. No se puede crear una vista de exportación sin `storage_path`
`src/csv-export-views/domain/value-objects/ValueObjectStoragePath.js` · test: `tests/csv-export-views/domain/value-objects/ValueObjectStoragePath.unit.test.js:15`

El constructor llama `super(field, value)` sin reenviar su propio parámetro `nullable`, así que
`ValueObjectString` corre siempre con su `nullable = false` por defecto y lanza **antes** de que el
control vuelva a las comprobaciones propias del objeto. Las dos ramas de esos dos `if` son código
muerto: `nullable: true` no hace aceptable un valor vacío. `CsvExportView` depende justo de eso para
poder crearse antes de haberse ejecutado nunca.

### 7. Dos setters de `S3ImportFile` lanzan para cualquier valor
`src/imports/domain/S3ImportFile.js` · test: `tests/imports/domain/S3ImportFile.unit.test.js:198`

`status` y `target_table` construyen `new ValueObjectShortString50(value)`, pasando el valor nuevo
en la posición de `label` y dejando el argumento real `value` en `undefined`. El constructor lanza
"The value cannot be null" para cualquier valor no vacío: **los dos setters son inservibles
justamente cuando cambiarían algo**.

### 8. Dos errores de dominio son en realidad `ReferenceError`
`src/actions/application/update/ActionUpdater.js:70` y `src/actions/domain/ModelValueSaver.js:256-259`
tests: `tests/actions/ActionIntegration.test.js:99` y `tests/actions/types/services/ModelValueSaver.test.js:518`

En el primero, `throw new CustomError('Dynamic code path not exist')` referencia una clase que —a
diferencia de la comprobación casi idéntica de `ActionCreator`— **nunca se importa en ese archivo**.
En el segundo, `ValidationFailError(...)` se invoca como función suelta, **sin `new` y sin estar
importada**: dos errores en una línea. En ambos casos, en vez del error de dominio previsto sale un
`ReferenceError` crudo.

### 9. Falta un `calc` y sale un `TypeError` en vez del mensaje de ayuda
`src/schemas/domain/validator-types/CalculateTypeValidator.js:69` · test: `tests/schemas/domain/validator-types/CalculateTypeValidator.test.js:7`

La validación lee `config.calc.formula` **antes** de comprobar `!config.calc` (línea 78, con su
mensaje amable ya redactado). Si falta el campo `calc`, revienta con "Cannot read properties of
undefined". La comprobación de la línea 78 es, en la práctica, inalcanzable.

### 10. Una respuesta sin asunto tumba el envío con un error de bajo nivel
`src/emails/application/reply/EmailReplier.js` · test: `tests/emails/EmailReplierUnitTest.test.js:194`

`#execute` toma el asunto como opcional (`replyResp?.subject ?? null`) y luego se lo pasa a
`new Email({ subject, ... })`, cuyo objeto de valor **no** admite nulos. Cuando Channel Hub omite
el asunto sale un error de dominio sin manejar en vez del `CustomError` con código 502 que sí da
la guarda hermana.

### 11. Recorrer una ruta de esquema hasta una hoja lanza `TypeError`
`src/actions/domain/validators/ActionSchemaPathValidator.js` · test: `tests/actions/ActionSchemaPathValidatorUnit.test.js:42`

Al llegar a un valor hoja (una cadena), el bucle sigue aplicando `key in currentDataStructure`
dando por hecho que sigue siendo un objeto. Sobre un primitivo, el operador `in` lanza
`TypeError: Cannot use 'in' operator...` en lugar del `false` que se pretendía.

---

## Medios — comportamiento incorrecto silencioso

### 12. Cualquier colisión de clave única se reporta como "email ya enlazado"
`src/interactions/application/create/InteractionCreator.js` y `src/interactions/infrastructure/persistence/KnexInteractionRepository.js`
tests: `tests/interactions/InteractionCreatorRaceUnit.test.js:81` y `tests/interactions/infrastructure/KnexInteractionRepositoryBranches.test.js:126`

La heurística mira si el mensaje de error contiene `unique` y `email_id`, pero Knex antepone al
mensaje el SQL completo del `INSERT`, **cuya lista de columnas siempre incluye `email_id`**. Así,
una carrera por el mismo `id` termina reportando un email que no tiene ninguna fila asociada.

### 13. La rama que "normaliza" arrays no convierte nada
`src/imports/domain/services/CsvValueNormalizer.js` · test: `tests/imports/ImportsUnit.test.js:286`

Hace `JSON.parse(JSON.stringify(value))` sobre un valor que **ya es una cadena**, así que
`JSON.stringify('[1,2,3]')` produce `'"[1,2,3]"'` y volver a parsearlo devuelve la cadena original.
El valor "normalizado" es idéntico byte a byte a la entrada; bastaría `JSON.parse(value)`.

### 14. `metadata.count` de adapters es un objeto, no un número
`src/rabbitmq/infrastructure/persistence/KnexAdapterSettingsRepository.js` · test: `tests/rabbitmq/application/search/AdapterSearcher.test.js:34`

Devuelve la fila cruda de Postgres (`{count: '1'}`) en lugar de desenvolverla a número, como sí
hace `KnexMapperRepository.count()`. `AdapterCounter` la reenvía tal cual y el buscador acaba
publicando `metadata.count = {count: {count: '1'}}`.

### 15. Un alias SQL con las comillas dobles duplicadas
`src/boards/infrastructure/persistence/KnexBoardPrimaryRepository.js` · test: `tests/boards/KnexBoardPrimaryRepositoryUnit.test.js:75`

### 16. Cuatro setters de `User` cambian el tipo de la propiedad
`src/users/domain/User.js` · test: `tests/users/domain/User.test.js:287` y `:336`

`last_seen_at` y `last_login_at` asignan el valor crudo sin envolverlo en `ValueObjectTimestamp`,
y `grid` hace lo mismo mientras el constructor sí lo envuelve en `ValueObjectJson`. En cuanto se
usa el setter una vez, el getter deja de devolver un objeto de valor, y `toJson()` /
`toRulesContext()` —que esperan un `.value` para serializar a ISO— reciben el valor crudo.

### 17. El token de sesión no lleva el rol del usuario, sino un objeto vacío
`src/users/domain/User.js:609` · test: `tests/users/application/auth/Login.test.js`

`authenticate()` compone el payload con `rol: this.#rol_id` — el objeto de valor entero — mientras
que las dos líneas contiguas sí usan `.value`. Como `ValueObject` guarda su contenido en un campo
privado `#value`, `JSON.stringify` no lo serializa: **el token viaja con `rol: { field: "rol_id" }`
y nunca con el uuid del rol**.

Impacto hoy: contenido. Ningún consumidor lee ese claim — los `jwtDecode` del frontend y
`controllerSession.mjs` trabajan sobre tokens de Cognito. Pero cualquier autorización futura que se
apoye en `payload.rol` recibiría un objeto truthy en lugar del identificador, que es justo la forma
de fallo que un `if (payload.rol)` no detecta.

Salió al escribir el assert que verifica el payload: hasta esta rama **ningún test de la suite
decodificaba un token**, así que el claim nunca se había mirado.

### 18. El historial de un borrado lógico no registra quién ni cuándo
`src/shared/domain/AggregateRoot.js:220-227` · test: `tests/boards/BoardDeleter.test.js`

`toJson()` termina componiendo su salida con una lista explícita de campos de auditoría —`id`,
`created_at`, `created_by`, `updated_at`, `updated_by`— que **omite `deleted_at` y `deleted_by`**.
Como `saveHistory` serializa el agregado con `toJson()`, el historial de un borrado lógico no
conserva ni la marca de tiempo ni el autor del borrado.

Verificado ejecutando: sobre un agregado de prueba, `toJson()` devuelve exactamente las mismas
claves antes y después de `delete(dto)`, mientras que el getter `deleted_at` sí tiene valor. Afecta
a las 77 clases que extienden `AggregateRoot`, ninguna de las cuales redefine estos getters.

Efecto secundario en los tests: el bug realista de capturar el snapshot *después* de mutar el
agregado es indistinguible desde la API pública en el caso del borrado, porque las dos fotos salen
iguales. En `BoardUpdater` sí se detecta; en `BoardDeleter` no, y por eso ese test fija el
comportamiento actual en lugar de comprobar el correcto.

El bucle previo tiene además una limitación propia: recorre solo
`Object.getOwnPropertyNames(Object.getPrototypeOf(this))`, es decir el prototipo inmediato, sin
subir por la cadena. Los cinco campos de la lista explícita lo compensan; cualquier getter futuro
que se añada a `AggregateRoot` quedaría invisible igual que estos dos.

---

## Deuda de test preexistente, no de esta rama

Dos casos de `AssignSelectedGroupsCase` llevan pasando desde siempre porque un `catch` genérico
se traga un `TypeError`: la lógica que sus nombres describen no se ejecuta jamás.
