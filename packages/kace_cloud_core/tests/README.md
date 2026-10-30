# Cómo escribir tests en `@kace/core`

Esta guía recoge las reglas que dejó la reparación de la suite: de 612 tests rojos a cero. Casi
todas nacen de un fallo real que costó horas encontrar, así que cada una viene con el porqué. Si
solo lees una sección, que sea **«Las cinco reglas que rompen tests»**.

Todo lo que sigue asume que trabajas desde `packages/kace_cloud_core`.

---

## 1. Lo que la infraestructura ya hace por ti

No tienes que montar una base de datos, ni limpiarla, ni migrarla. El arranque de jest lo resuelve:

-   **Una base de datos PostgreSQL por archivo de test.** Se clona de una plantilla ya migrada y
    sembrada (`CREATE DATABASE ... TEMPLATE ...`), y se destruye al terminar el archivo. Dos archivos
    nunca se pisan, y puedes lanzar varias corridas a la vez sin que se destruyan entre sí.
-   **Un reset a estado de plantilla antes de cada `it`.** Lo hace `tests/support/perFileDatabase.js`.
    Cada `it` empieza con la base exactamente como la dejó la semilla.
-   **La conexión ya apunta a tu base.** Importa `knexConfig` de `../knexfile.js` y ya está.

```javascript
import { knexConfig } from '../knexfile.js';
import { KnexCaseRepository } from '../../src/cases/infrastructure/persistence/KnexCaseRepository.js';

const repository = new KnexCaseRepository(knexConfig);
```

**No uses sqlite.** Hay un test que lo impide (`tests/support/noSqliteInTests.test.js`). La suite
corre contra el mismo motor que producción, y media fase se fue en arreglar tests que solo pasaban
porque sqlite era más permisivo.

---

## 2. El esqueleto

```javascript
import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { KnexCaseRepository } from '../../src/cases/infrastructure/persistence/KnexCaseRepository.js';
import { ensureParentRow } from '../support/ensureParentRow.js';

describe('CaseFinder (integration)', () => {
    const repository = new KnexCaseRepository(knexConfig);

    let responsableId;

    beforeEach(async () => {
        responsableId = uuidv4();
        await ensureParentRow(repository.connection, 'usuarios', responsableId);
    });

    it('devuelve los casos abiertos del grupo', async () => {
        // Arrange
        const kase = await CasesMother.createCase(repository, { responsable_id: responsableId });

        // Act
        const result = await new CaseFinder(repository).execute(kase.id.value);

        // Assert
        expect(result.id.value).toBe(kase.id.value);
    });
});
```

El repositorio se construye **una vez, fuera de los `it`**. Los datos se siembran **dentro** de un
`beforeEach` o del propio `it`, porque el reset los borra entre tests.

---

## 3. Las cinco reglas que rompen tests

### 3.1. En `afterAll` no puedes tocar la base

jest-circus ejecuta los `afterAll` **en orden de registro, no en orden inverso**. El de
`perFileDatabase.js` se registra primero (viene de `setupFilesAfterEnv`), así que cuando llega el
tuyo la base ya no existe: hizo `DROP DATABASE`.

```javascript
// ❌ Revienta: la base ya no está
afterAll(async () => {
    await repository.connection('cases').del();
});

// ✅ No hace falta limpiar nada: el reset lo hace por ti
```

Un `beforeEach` propio **sí** funciona, porque se registra después del reset y corre después de él.

### 3.2. Espera todas las escrituras

Una llamada a una factoría sin `await` sigue viva cuando el `it` ya terminó. Choca contra el
`TRUNCATE ... CASCADE` del reset del test siguiente, que sostiene `AccessExclusiveLock`, y postgres
mata a una de las dos. **El fallo aparece imputado a un test inocente**, normalmente el siguiente.

```javascript
// ❌ Interbloqueo latente
CasesMother.createCase(repository);

// ✅
await CasesMother.createCase(repository);
```

### 3.3. `expect(async () => ...).not.toThrow()` no espera nada

Ese matcher llama a la función, recibe una promesa, ve que no hubo excepción **síncrona** y da el
test por bueno. El `await` de delante espera al matcher, no al trabajo. Es la forma más común de
crear el problema de 3.2 sin darte cuenta.

```javascript
// ❌ No prueba nada, y suelta una escritura huérfana
await expect(async () => {
    await groupAssign.execute(dto);
}).not.toThrow();

// ✅
await expect(groupAssign.execute(dto)).resolves.toBeUndefined();
await expect(groupAssign.execute(malDto)).rejects.toThrow(ValidationFailError);
```

### 3.4. Postgres no devuelve lo que crees

Tres conversiones que provocaron decenas de rojos:

| Columna     | Lo que devuelve el driver         | Aserción correcta                              |
| ----------- | --------------------------------- | ---------------------------------------------- |
| `count()`   | `string` (`"10"`)                 | `expect(Number(row.count)).toBe(10)`           |
| `boolean`   | `true` / `false`, nunca `1` / `0` | `expect(row.is_active).toBe(true)`             |
| `timestamp` | objeto `Date`, no cadena ISO      | `expect(row.due_date.toISOString()).toBe(iso)` |
| `jsonb`     | objeto ya parseado                | `expect(row.data.ciudad).toBe('Medellín')`     |

El último es traicionero: `String(row.data)` da `"[object Object]"`, así que un
`.includes('"clave":valor')` no puede acertar nunca.

Y ojo con los literales sin tipo: en una vista construida con `UNION ALL`, `'2025-12-01 10:00:00'`
se resuelve como `text`, no como `timestamp`, y las comparaciones pasan a ser **léxicas**. Pon
`::timestamp` explícito.

### 3.5. Tu test no está solo en la base

La base clonada **ya trae semillas**: usuarios, roles, definiciones auxiliares. Un test que asume
tabla vacía es un test que fallará en cuanto alguien añada una fila a la semilla.

```javascript
// ❌ Cuenta todo lo que haya en la base
const grupos = await finder.findWorkQueueGroupsWithCapacity();
expect(grupos).toHaveLength(1);

// ✅ Acota a lo que siembra este test
const mios = grupos.filter((g) => misIds.includes(g.id));
expect(mios).toHaveLength(1);
```

Lo mismo con `usuarios[0]`, con `limit(1)` sin `ORDER BY` y con cualquier `.first()` sobre una tabla
que la semilla puede tocar: no eliges tú la fila, la elige el planificador.

---

## 4. Sembrar datos

### Claves ajenas: `ensureParentRow`

Crea la fila padre mínima si no existe, y no hace nada si ya está. Ignora un id nulo.

```javascript
import { ensureParentRow, ensureParentRows } from '../support/ensureParentRow.js';

await ensureParentRow(connection, 'usuarios', userId);
await ensureParentRows(connection, [
    { table: 'roles', id: dto.rol_id },
    { table: 'grupos', id: dto.grupo_activo },
]);
```

Algunas tablas necesitan columnas extra por ser `NOT NULL`; el helper ya las conoce (`agendas`,
`plantillas`, `transition_rules`). Si añades una tabla nueva con `NOT NULL`, amplíalo ahí en vez de
inventar el insert en tu test.

### Mothers: el patrón

Una _mother_ por entidad, en `tests/<contexto>/domain/<Entidad>Mother.js`, con tres piezas:

```javascript
static dto(override = {}) { /* devuelve un DTO coherente */ }
static async ensureRelations(connection, dto) { /* las claves ajenas del dto */ }
static async create(repository, override = {}) {
    const dto = this.dto(override);
    await this.ensureRelations(repository.connection, dto);
    const entity = Entidad.create(dto);
    await repository.save(entity);
    return entity;
}
```

**El DTO tiene que ser coherente consigo mismo.** Un caso real: una _mother_ calculaba un
`classification_id`, lo usaba como raíz del flujo JSON y luego le daba a la entidad **otro id**. El
nodo raíz pasaba a contarse como una relación más, y todos los tests que contaban relaciones
contaban uno de sobra.

### El apóstrofe: no uses `chance.last()` sin filtrar

`chance.last()` emite apellidos con apóstrofe ASCII (`O'connor`, `D'Angelo`) el **0,45 %** de las
veces, y `ValueObjectUserName` los rechaza —es un defecto de producción documentado, no del test—.
Con dos apellidos por usuario, eso es una moneda al aire en cada creación.

Peor aún: **`CaseFactory` resuelve `responsable_id` con `UserFactory` cuando no se lo pasas.** Un
archivo con 33 creaciones de caso tenía un 24 % de probabilidad de ponerse rojo en cada corrida, y
`Factory.create` se traga el error real, así que el síntoma es un escueto `Error creating factory
instance` imputado a un `it` distinto cada vez.

```javascript
// ✅ Siembra tu propio responsable y la relación no se resuelve
const createCase = (overrides = {}) =>
    new CaseFactory(knexConfig).create({ responsable_id: responsableId, ...overrides });
```

Si usas `UserFactory` directamente, pásale apellidos fijos.

---

## 5. Servicios externos

**Ningún test debe salir a la red.** Hay mocks preparados en `tests/support/mocks/`:

```
awsEventBridge.js   awsS3.js   awsSqs.js   gmail.js   msGraph.js   rabbitmq.js   smtp.js
```

Como los mocks usan `jest.unstable_mockModule`, que solo alcanza a lo que se carga **después**, los
imports que arrastren la librería real tienen que ser dinámicos:

```javascript
import { mockSmtp } from '../support/mocks/smtp.js';

mockSmtp();
const { SmtpEmailService } = await import('../../src/mails/smtp/SmtpEmailService.js');
```

Si un test necesita un servicio externo que aquí no existe y no puedes mockearlo, **no lo hagas
pasar a la fuerza**: `it.skip` con `// KACE-SKIP(decision-pendiente): ...` y dilo en la PR.

---

## 6. Tenant, permisos y matvistas

```javascript
import { withTestTenant } from '../support/testTenant.js';
import { grantGlobalRolePermissions } from '../support/testRolePermissions.js';
import { refreshMatview } from '../support/refreshMatview.js';

await withTestTenant(async () => {
    /* código que lee TenantContext.getTenant() */
});
await grantGlobalRolePermissions(connection);
await refreshMatview(connection, 'mi_matview');
```

Si un servicio lee `TenantContext` y no lo envuelves, el fallo llega disfrazado de error de base de
datos.

---

## 7. Fechas: nunca dependas del reloj ni de la zona

Dos fuentes de rojos intermitentes:

-   **La zona del proceso.** `DayjsFactory` fija la zona a `process.env.TIMEZONE`
    (America/Bogota), que no tiene por qué ser la tuya. Un test que compara contra `new Date()` local
    falla en cualquier máquina con otra zona. Ancla la zona en el test o compara instantes, no cadenas.
-   **La hora de pared.** Un cron `'0,1 * * * *'` que el test afirma que no dispara es rojo el 3,3 %
    del tiempo. Construye la expresión **relativa a ahora** para que la afirmación sea siempre cierta,
    o afirma sobre el motivo que devuelve el servicio en vez de sobre el booleano.

```javascript
// ✅ Falso siempre, sea la hora que sea
const currentMinute = new Date().getMinutes();
const frequency = `${(currentMinute + 20) % 60} * * * *`;
```

---

## 8. Cuándo se permite un `it.skip`

Solo tres motivos, y siempre con marca y explicación en cuatro líneas o menos:

| Marca                                   | Cuándo                                                   |
| --------------------------------------- | -------------------------------------------------------- |
| `// KACE-SKIP(bug-src): ...`            | El test es correcto y falla por un defecto de producción |
| `// KACE-SKIP(obsoleto): ...`           | El test describe un comportamiento que ya no existe      |
| `// KACE-SKIP(decision-pendiente): ...` | Depende de algo que el equipo aún no ha decidido         |

**«No consigo que pase» no es un motivo.** Un skip sin una de esas tres marcas es un test roto
escondido. Y si pones `bug-src`, escribe también el defecto en el documento de bugs priorizados:
`docs/superpowers/specs/2026-08-08-kace-core-src-bugs-priorizados.md`.

Nunca borres un `it`. Si sobra, argumenta por qué en la PR.

---

## 9. Cómo se ejecuta

```bash
# Toda la suite
pnpm run tests

# Un archivo, o un directorio (contexto acotado)
pnpm run tests tests/cases/CasesIntegration.test.js
pnpm run tests tests/grupos/

# Un test por nombre
pnpm run tests tests/cases/CasesIntegration.test.js -t "nombre del it"
```

### Desde el IDE

Funciona, incluido «Rerun Failed Tests». Los IDE lanzan jest con `--runTestsByPath` y construyen la
lista con **una entrada por test fallido**, no por archivo, así que un archivo con varios rojos
llegaba repetido y jest no deduplica esas rutas: el mismo archivo corría a la vez en dos workers y
los dos se peleaban por su base de datos. Lo cierran dos piezas, y conviene no quitarlas sin
entender esto:

-   `tests/support/dedupeSequencer.cjs` (`testSequencer` en `jest.config.js`) quita las rutas
    repetidas antes de repartir el trabajo.
-   El nombre de la base lleva el `JEST_WORKER_ID` (`tests/support/dbNaming.js`), así que dos
    ejecuciones concurrentes del mismo archivo tienen bases distintas pase lo que pase.

### Cuando algo falla y el mensaje no dice nada

`Transaction failed: error retrieving data.` es solo el envoltorio. **La causa real está en el campo
`error` del log, y ese campo solo se emite con `NODE_ENV=diagnostic`**:

```bash
KACE_DIAGNOSTIC_OUTPUT=/tmp/diag.jsonl pnpm run test:diagnose tests/mi/Archivo.test.js
```

Eso deja un JSONL con una entrada por suite: cruza `failures[].messages` con `console[].message`
parseado como JSON y tendrás el error de verdad, con su stack.

### Inventario de bases

```bash
node tests/support/listTestDatabases.mjs
```

En reposo debe salir **una plantilla y cero bases por archivo**. Si ves bases `kace_t_` acumuladas,
alguna corrida murió sin cerrar; el barrido las retira a las dos horas.

No hace falta pedirlo a mano en cada corrida: el `globalTeardown` cuenta lo que le quedó por
reclamar y lo imprime al final (`[globalTeardown] N base(s) por archivo sin reclamar`). En una
corrida sana no imprime nada. Esa línea es la señal de fuga, y por eso el `afterAll` de
`perFileDatabase.js` ya **no** pone la suite en rojo cuando no consigue borrar su base: antes
tumbaba archivos con todos sus tests en verde.

---

## 10. El trinquete

`tests/support/red-baseline.txt` está **vacío**, y esa es la condición de la rama: cero rojos.

```bash
node tests/support/redRatchet.mjs /tmp/diag.jsonl
```

Si sale un bloque `REGRESIONES`, has roto algo que estaba verde. No aceptes la línea base para
taparlo: `--accept` existe para bajar el listón, no para subirlo.

`tests/support/flaky.txt` tiene **una** entrada. Cada línea de ese archivo es un test que no sabe lo
que prueba. Si añades una, tienes que explicar la causa **medida** encima, no sospechada.

---

## Antes de abrir la PR

-   [ ] El archivo pasa dos veces seguidas, no una.
-   [ ] Ningún `afterAll` toca la base.
-   [ ] Toda llamada a _mother_ o factoría lleva `await`.
-   [ ] Ningún `expect(async () => ...)`.
-   [ ] Las aserciones sobre `count`, booleanos, timestamps y jsonb usan el tipo que devuelve pg.
-   [ ] El test acota sus aserciones a los datos que él siembra.
-   [ ] Ninguna llamada a un servicio externo real.
-   [ ] Ningún `it.skip` sin una de las tres marcas.
-   [ ] `node tests/support/redRatchet.mjs` sin bloque `REGRESIONES`.

Si algo falla de forma intermitente, **no lo reintentes hasta que pase**: mídelo. Cuenta cuántas de
20 corridas caen, y si es un dado, fuérzalo. Un fallo del 1 % que se ignora hoy es media jornada de
alguien dentro de tres meses.
