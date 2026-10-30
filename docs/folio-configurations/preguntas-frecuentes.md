# Preguntas frecuentes — Generador de folios / radicados

Las decisiones de diseño que más se preguntan, con el código que las sostiene. Las referencias usan
nombres de clase y método, no números de línea.

---

## P1

### ¿Por qué no era viable reutilizar el campo `reference` de casos manteniendo la retrocompatibilidad?

**Respuesta corta:** porque `reference` no es un campo de la aplicación, es un `SERIAL` de Postgres.
Convertirlo en alfanumérico exige un cambio de tipo destructivo y rompe consumidores que hoy asumen
que siempre trae un número.

#### a) `reference` no lo escribe la aplicación

```js
// migrations/20250124092733_alter_table_casos_add_column_reference.js
table.specificType('reference', 'SERIAL').unique();
```

Lo genera la secuencia de Postgres en el `INSERT`. No aparece en el `insert` de
`KnexCaseRepository.save()` ni en el Joi de casos, que con Joi 17 rechaza claves desconocidas: un
`reference` enviado por API da 400. Para que la aplicación lo escribiera habría que quitarle el
`DEFAULT nextval(...)`, y a partir de ahí la secuencia y los datos quedarían desincronizados.

#### b) El cambio de tipo es destructivo

Un folio es alfanumérico (`5261000000050`, `PQRS-2026-000042`). Reutilizar `reference` exige
`integer → varchar` sobre `cases`, la tabla más grande del esquema, con reescritura completa,
eliminación de la secuencia y `DROP`/`CREATE` de `view_casos` y `view_case_details`.

#### c) La retrocompatibilidad se rompe en varios frentes

| Consumidor | Dónde | Qué se rompe |
| --- | --- | --- |
| Filtros y ordenamiento | `FieldCatalog.CASES_COLUMNS` → QueryTranslator | Las comparaciones numéricas guardadas cambiarían de semántica: en texto, `'10' < '9'`. |
| Integraciones externas | `ActionQueueExecutionsExecutor` (`reference: caseObj.reference.value`) | El payload viaja a sistemas de terceros con un contrato que no controlamos. |
| Búsqueda directa | `CaseFinder.executeByReference` → `KnexCaseRepository.findByReference` | Identificador de búsqueda por número. |
| Vistas | `view_casosV7`, `view_cases_details_v10` | Alimentan grillas, reportes y exports. |
| Grillas y UI | `CaseDataGrid`, `CaseDataTable/utils/processCasesData.js` | Se muestra al usuario como **«Consecutivo»**. |

#### d) El folio no existe para todos los casos

El folio **solo** se genera cuando la clasificación tiene una configuración. Si `reference` pasara a
ser el folio, los casos históricos tendrían un valor que no cumple la nueva estructura y los casos
de clasificaciones sin configuración tendrían `NULL` donde hoy **siempre** hay un número.

#### Solución adoptada

Columna nueva `cases.folio VARCHAR(100) NULL` + índice único parcial
`idx_cases_folio_unique ON cases (folio) WHERE folio IS NOT NULL`. `reference` queda intacto, y el
frontend usa `getCaseCode() = external_code || folio` como código visible sin tocar el Consecutivo.

---

## P2

### ¿Cómo se controla el consecutivo entre diferentes configuraciones de folios?

**Están aislados por construcción**: no hay un contador global, hay una fila de contador por
configuración.

```sql
CREATE TABLE folio_sequences (
    config_id     varchar(36),
    scope_key     varchar(120), -- '' cuando el contador nunca reinicia
    current_value integer,
    start_value   integer,
    PRIMARY KEY (config_id, scope_key)
);
```

La configuración A puede ir por 50 mientras la B va por 12 000: no se ven entre sí, no compiten por
el mismo lock y no se afectan al reiniciar.

### El segundo eje: `scope_key`

Una misma configuración puede tener varios contadores vivos, según su `reset_policy`
(`ScopeKeyResolver.resolve`):

| `reset_policy` | `scope_key` | Filas de contador | Requisito al guardar |
| --- | --- | --- | --- |
| `never` | `''` | Una sola, para siempre | — |
| `yearly` | `2026` | Una por año | El folio lleva el año |
| `monthly` | `2026-10` | Una por mes | El folio lleva año y mes |
| `daily` | `2026-10-15` | Una por día | El folio lleva año, mes y día |
| `prefix` | el folio renderizado **hasta** el consecutivo | Una por prefijo distinto | Hay algo delante del consecutivo |

La fecha del `scope_key` se calcula con `createDayjsInstance({})`, el mismo reloj y zona horaria del
tenant que usan los segmentos `date`. El requisito de la última columna existe porque, al
reiniciar, el contador vuelve a entregar los mismos números: sin la fecha en el folio, en una
posición que no dependa de ningún campo, se repetirían folios ya emitidos (`FolioUniquenessPolicy`).

### ¿Y si dos configuraciones producen la misma cadena?

Como los contadores no se hablan, dos configuraciones podrían generar el mismo folio. Hay tres
defensas:

1. **Al guardar**, `FolioConfigurationLayoutGuard` rechaza una configuración activa que pueda
   renderizar un folio que otra también renderiza (`FolioUniquenessPolicy.overlaps`). Compara el
   espacio de cadenas que produce cada estructura, no sus piezas, así que `RAD-` + 4 dígitos y
   `RAD-0` + 3 dígitos, o `YYYY-` y el literal `2026-`, también chocan. Compara contra las
   configuraciones activas y contra **todas las que ya emitieron**, aunque estén desactivadas o
   borradas, incluido el ancho de consecutivo con el que emitieron. Con campos solo detecta las
   estructuras idénticas.
2. **Al generar**, `CaseFolioResolver` comprueba antes de reservar si el siguiente folio ya existe.
   Si existe, `skipTaken` avanza el contador más allá de los ocupados en una transacción propia que
   se confirma, así que un rollback del caso no lo deshace y no quedan huecos visibles. Dentro de la
   transacción del caso se vuelve a comprobar cada reserva (hasta 5 intentos, después 409) para las
   carreras. Cubre lo que el paso 1 no puede detectar estáticamente, como dos estructuras con campos
   que coinciden en algún valor o un folio cargado a mano.
3. **En la base**, el índice único sobre `cases.folio` hace de última red ante una carrera, y
   `KnexCaseRepository.#rethrowDuplicatedFolio` lo traduce a un 400 transitorio.

Sin el salto confirmado, una colisión era **permanente**: el rollback devolvía los números saltados
y la creación siguiente volvía a chocar con los mismos folios. La recomendación operativa sigue
siendo que cada configuración lleve un prefijo o unas siglas que la distingan.

### Borrado

Eliminar una configuración es un borrado **lógico** y **no borra sus contadores**, porque son la
memoria de qué números ya se entregaron. No se puede borrar una configuración que tenga
clasificaciones asociadas, y una clasificación no puede apuntar a una configuración borrada o
inexistente.

---

## P3

### ¿Cómo se controla el consecutivo si una configuración de folio se usa en varias clasificaciones?

**El contador cuelga de la configuración, no de la clasificación.** `folio_sequences` se indexa por
`config_id`. `CaseFolioResolver` usa el `clasificacion_id` **solo** para *encontrar* la configuración
(`findByClassificationId`) y a partir de ahí trabaja con `configuration.id`.

Si las clasificaciones A, B y C usan la configuración X, **comparten una única secuencia
continua**:

```
Clasificación A ─┐
Clasificación B ─┼──▶ Configuración X ──▶ folio_sequences(config_id=X, scope_key='')
Clasificación C ─┘                              └── un único contador: 1, 2, 3, 4…
```

Es intencional: la unidad de negocio que el cliente pacta es la configuración ("los PQRS se radican
con esta estructura"), no la clasificación.

### Si se necesita numeración independiente por clasificación

**Opción 1 — una configuración por clasificación.** Es lo más explícito. Cada una necesita un texto
fijo distinto, porque dos configuraciones no pueden producir los mismos folios.

**Opción 2 — `reset_policy: 'prefix'` con un segmento que varíe por clasificación.** El `scope_key`
pasa a ser el prefijo renderizado, y cada valor lleva su propio contador dentro de la misma
configuración:

```json
{
    "reset_policy": "prefix",
    "segments": [
        { "type": "field", "path": "clasificaciones.nivel1" },
        { "type": "literal", "value": "-" },
        { "type": "sequence", "length": 6, "pad_char": "0" }
    ]
}
```

> `clasificaciones.*` solo se puede configurar por API: la pantalla ofrece campos del Caso y del
> Auxiliar. `clasificaciones.description` está prohibida porque `RuleValidator.getFieldValue` la
> reescribe a `clasificaciones.id` y embebería un UUID en el radicado; `nivel1`, `nivel2`… sí son
> válidas.

### Reclasificación

Si un caso ya tiene folio y se reclasifica, **conserva el suyo**: un radicado nunca se regenera
(`CaseUpdater`, condición `folioResolver && !kase.folio?.value`).

Si el caso **no** tenía folio y pasa a una clasificación configurada, recibe el folio **de la
clasificación de destino**, dentro de la misma transacción que el `UPDATE`. La clasificación nueva
viaja como escritura con comparación de snapshot (CAS) y todavía no está aplicada en el agregado
cuando se resuelve el folio. Por eso `CaseUpdater` la toma de la escritura pendiente y no del caso.
Un caso solo consume un número del contador de la configuración a la que llega, y solo una vez.
Vale igual para `case_reclassify` y para la reclasificación desde la edición del auxiliar. En esta
última el auxiliar se guarda **después** de reclasificar, así que un segmento `aux_cases.*` se
resuelve con el `aux_cases.data` de la petición fusionado sobre el persistido (leído sin
`EntityCache`), no con el valor anterior a la edición.

---

## P4

### ¿Cómo se controla que no se repita el consecutivo si se procesan varios casos al mismo tiempo?

Hay varias capas independientes y un límite de espera.

### Capa 1 — Incremento atómico en una sola sentencia

```sql
UPDATE folio_sequences
SET current_value = current_value + 1, updated_at = $1
WHERE config_id = $2 AND scope_key = $3
RETURNING current_value;
```

Bajo `READ COMMITTED` (el nivel por defecto de Postgres, que nada en el repositorio cambia), ese
`UPDATE` toma un **row lock** sobre la fila del contador hasta el `COMMIT`. Una segunda transacción
que llegue a la misma fila **se bloquea** y, cuando el lock se libera, **re-evalúa
`current_value + 1` sobre la fila ya confirmada**. Da igual que sean dos Lambdas en conexiones
distintas: el punto de serialización es la fila.

> **Por qué no `SELECT` + `UPDATE`.** Leer el valor y escribir `leído + 1` en dos pasos no es seguro:
> ambas transacciones leerían el mismo valor y una escritura se perdería (*lost update*). Es el
> defecto del folio legado `countCreatedToday`.

La creación de la fila también es segura: `insert({ current_value: start_value - 1 }).onConflict([...]).ignore()`.
Si dos transacciones siembran a la vez, la segunda no hace nada.

### Capa 2 — La reserva vive dentro de la transacción del caso, al final

El `trx` del caso se propaga hasta `reserveNext`, así que un rollback **devuelve el número**.

La reserva es el **último paso antes de escribir el caso**: `CaseCreator` comprueba antes el id, el
`external_code` y las reglas de transición. Así la fila del contador queda bloqueada solo entre la
reserva y el INSERT, y las creaciones concurrentes de una configuración se serializan durante ese
tramo, no durante toda la creación.

Además, todo lo que puede fallar sin efectos secundarios (configuración rota, campo auxiliar vacío,
folio de más de 100 caracteres) se resuelve **antes** de tocar el contador. Un 400 no consume
número.

### Capa 3 — Las reglas de la configuración

`FolioUniquenessPolicy` solo acepta estructuras en las que dos pares (ámbito, número) distintos no
pueden producir el mismo folio. Por ejemplo, prohíbe un relleno `9`, un reinicio anual sin año o
campos a ambos lados del consecutivo. Un test exhaustivo lo comprueba renderizando todas las
combinaciones de una muestra.

### Capa 4 — Folio ocupado e índice único

Si aun así el folio ya existe, `CaseFolioResolver` salta ese número y reserva el siguiente. El
índice único `idx_cases_folio_unique` es la última red ante una carrera: la base rechaza el duplicado
en lugar de almacenarlo, y `KnexCaseRepository.#rethrowDuplicatedFolio` lo traduce a un 400. El
error está cableado en `save()` y en `update()` mediante el hook `translateWriteError` de
`KnexRepository`.

### Límite de espera: 3 segundos

`reserveNext` fija `lock_timeout = '3s'` **antes** de la siembra, que también puede esperar a otra
transacción, y lo restaura en cuanto termina el incremento para no imponerlo al resto de la
transacción del caso. El `55P03 lock_not_available` se traduce a **409 «El folio está en
contención, reintente la operación»**, en lugar de colgarse hasta el timeout de API Gateway.

### Detalles que cierran el círculo

- **El preview nunca reserva**: usa `peek()` y muestra `current + 1`. Al editar una configuración
  guardada, el front envía su `id`, así que es el contador real de esa configuración.
- **`runPostPersistence` se difiere a después del commit**, en best-effort. Sin eso, un fallo
  posterior devolvería 500, el cliente reintentaría y se generaría un segundo folio para el mismo
  caso.
- **Los clones no heredan el folio**: `Case.clone()` fuerza `folio: null` y `CaseCloner` le asigna
  uno propio de su clasificación, dentro de la transacción del clon.
- **No hay reintentos automáticos** ante un 409: la decisión de reintentar es del llamante.

### Verificación

[`KnexFolioSequenceRepositoryConcurrencyIntegration.test.js`](../../packages/kace_cloud_core/tests/folio-configurations/KnexFolioSequenceRepositoryConcurrencyIntegration.test.js)
corre **contra Postgres real** con pool `min: 2, max: 20` y comprueba:

- 50 transacciones simultáneas → **50 números distintos y contiguos**;
- el primer número entregado es exactamente `start_value`;
- **un rollback devuelve el número sin dejar huecos**;
- contadores independientes por `scope_key`;
- `peek` no consume y devuelve `null` cuando no hay fila;
- con otra transacción reteniendo el contador, la segunda recibe el **409 dentro del
  `lock_timeout`**, y el `lock_timeout` de la transacción vuelve a su valor tras reservar.

El mismo archivo comprueba que, con 8 folios ocupados seguidos y un rollback en medio, las
creaciones sucesivas obtienen folio. `CaseFolioPaths.integration.test.js` comprueba además que dos
configuraciones con la misma estructura (creadas sin pasar por el guard) no bloquean la creación de
casos.
