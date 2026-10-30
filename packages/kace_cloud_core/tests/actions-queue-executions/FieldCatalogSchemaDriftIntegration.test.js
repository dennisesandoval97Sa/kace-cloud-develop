import { createCasesFieldCatalog } from '../../src/actions/domain/QueryTranslator/FieldCatalog.js';
import { knexConfig } from '../knexfile.js';
import TestHelper from '../TestHelper.js';

const TABLES_TO_CHECK = ['cases', 'clasificaciones', 'estados', 'clients'];

/**
 * `FieldCatalog` no es un espejo del esquema: es una lista blanca de los campos
 * que una regla de accion puede traducir a SQL. Todo lo que queda fuera lo esta
 * por diseño, no por descuido, y este archivo lo declara columna a columna para
 * que el guardia siga sirviendo a lo unico que puede detectar: una columna
 * NUEVA que nadie clasifico.
 *
 * Al añadir una columna a una de estas tablas hay que elegir: o entra en el
 * catalogo (`src/actions/domain/QueryTranslator/FieldCatalog.js`) o entra aqui.
 */
const ALLOWED_EXCLUDED = {
    // Ninguna de las cuatro es un campo de regla: dos son claves de integracion
    // de correo/canal que vienen de la migracion original de `casos` (2024), la
    // tercera es telemetria de lectura, y `estado_id` (MSKT-1392) es la copia
    // denormalizada del estado que el catalogo ya expone como `cases.estadoActual`
    // -resuelto contra `estados.id`-, asi que anadirla duplicaria el mismo filtro.
    cases: new Set(['mail_item_id', 'canal_id', 'first_view_at', 'estado_id']),
    // Del arbol de clasificaciones solo se filtran los diez niveles y el id;
    // el resto son metadatos de configuracion y auditoria.
    clasificaciones: new Set([
        'description',
        'flujo_id',
        'ans_id',
        'is_active',
        'created_at',
        'updated_at',
        'deleted_at',
        'created_by',
        'updated_by',
        'deleted_by',
        'default_group_id',
        'external_id',
        'can_start_sub_cases_flow',
        'json_flujo',
    ]),
    // De `estados` solo se exponen `id` y `nombre`; lo demas es presentacion
    // (icono, color), configuracion y auditoria.
    estados: new Set([
        'tipo_id',
        'descripcion',
        'icon_class',
        'status',
        'color',
        'require_observation',
        'created_at',
        'updated_at',
        'deleted_at',
        'created_by',
        'updated_by',
        'deleted_by',
    ]),
    // Del cliente se exponen los datos de identificacion y contacto primarios.
    clients: new Set([
        'tipo_cliente',
        'nombre_empresa',
        'sexo',
        'estado_civil',
        'email_alterno',
        'telefono_alterno',
        'status',
        'padre_id',
        'habeas_data',
        'created_by',
        'updated_by',
        'deleted_at',
        'deleted_by',
    ]),
};

describe('FieldCatalog schema-drift guard', () => {
    const knex = knexConfig;
    const testSchema = knexConfig.config.schema;
    const catalog = createCasesFieldCatalog();

    for (const table of TABLES_TO_CHECK) {
        it(`every column in ${table} resolves via FieldCatalog`, async () => {
            const rows = await knex('information_schema.columns')
                .where({ table_schema: testSchema, table_name: table })
                .select('column_name');
            const dbColumns = rows.map((r) => r.column_name);
            expect(dbColumns.length).toBeGreaterThan(0);

            const missing = dbColumns.filter((col) => catalog.resolve(`${table}.${col}`) === null);
            const excluded = ALLOWED_EXCLUDED[table] ?? new Set();
            const realMissing = missing.filter((c) => !excluded.has(c));

            expect(realMissing).toEqual([]);
        });
    }
});
