import { KnexExportsRepository } from '../../src/exports/infraestructure/persistence/KnexExportsRepository';
import { Criteria } from '../../src/shared';
import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';

const TABLE_NAME = 'aux_proveedores';

describe('ExportTableData - filtro deleted_at en tablas aux_', () => {
    const repository = new KnexExportsRepository(knexConfig);

    // La tabla se crea en cada test, no una sola vez: el reset por test elimina
    // las tablas que no vienen en el manifiesto de la plantilla, y esta es una de
    // ellas. El `hasTable` sigue siendo necesario porque el reset corre antes que
    // este hook solo a partir del segundo test.
    beforeEach(async () => {
        const hasTable = await repository.connection.schema.hasTable(TABLE_NAME);
        if (!hasTable) {
            await repository.connection.schema.createTable(TABLE_NAME, (table) => {
                table.string('id', 36).primary();
                table.jsonb('data').notNullable();
                table.timestamp('created_at');
                table.timestamp('updated_at');
                table.timestamp('deleted_at').nullable();
                table.string('created_by', 36);
                table.string('updated_by', 36);
                table.string('deleted_by', 36).nullable();
            });
        }
    });

    // Sin hooks de limpieza. El vaciado explicito sobra porque el reset por test
    // elimina la tabla entera antes de cada `it` y el hook de arriba la recrea. Y
    // el `afterAll` que la borraba tampoco puede quedarse: jest-circus ejecuta los
    // afterAll en orden de registro, asi que el de perFileDatabase.js -registrado
    // antes- ya hizo DROP DATABASE cuando este correria.

    it('deberia excluir registros con deleted_at cuando el campo viene SIN prefijo de tabla (como lo envia ExportAuxTableData)', async () => {
        const activeId = uuidv4();
        const deletedId = uuidv4();
        const now = new Date();

        await repository.connection(TABLE_NAME).insert([
            {
                id: activeId,
                data: JSON.stringify({ nombre: 'Activo' }),
                created_at: now,
                deleted_at: null,
                created_by: 'test',
            },
            {
                id: deletedId,
                data: JSON.stringify({ nombre: 'Eliminado' }),
                created_at: now,
                deleted_at: now,
                created_by: 'test',
            },
        ]);

        const criteria = new Criteria(
            [{ field: 'deleted_at', operator: 'null', value: 'null', type: 'AND' }],
            null,
            0,
            0,
            null,
            TABLE_NAME
        );

        const data = await repository.getData(TABLE_NAME, ['id', 'data'], criteria);

        expect(data).toHaveLength(1);
        expect(data[0].id).toBe(activeId);
    });

    it('deberia excluir registros con deleted_at cuando el campo viene CON prefijo de tabla', async () => {
        const activeId = uuidv4();
        const deletedId = uuidv4();
        const now = new Date();

        await repository.connection(TABLE_NAME).insert([
            {
                id: activeId,
                data: JSON.stringify({ nombre: 'Activo' }),
                created_at: now,
                deleted_at: null,
                created_by: 'test',
            },
            {
                id: deletedId,
                data: JSON.stringify({ nombre: 'Eliminado' }),
                created_at: now,
                deleted_at: now,
                created_by: 'test',
            },
        ]);

        const criteria = new Criteria(
            [{ field: `${TABLE_NAME}.deleted_at`, operator: 'null', value: 'null', type: 'AND' }],
            null,
            0,
            0,
            null,
            TABLE_NAME
        );

        const data = await repository.getData(TABLE_NAME, ['id', 'data'], criteria);

        expect(data).toHaveLength(1);
        expect(data[0].id).toBe(activeId);
    });

    it('deberia retornar todos los registros activos cuando hay multiples y varios eliminados', async () => {
        const active1 = uuidv4();
        const active2 = uuidv4();
        const active3 = uuidv4();
        const deleted1 = uuidv4();
        const deleted2 = uuidv4();
        const now = new Date();

        await repository.connection(TABLE_NAME).insert([
            { id: active1, data: JSON.stringify({ n: 1 }), created_at: now, deleted_at: null, created_by: 'test' },
            { id: active2, data: JSON.stringify({ n: 2 }), created_at: now, deleted_at: null, created_by: 'test' },
            { id: active3, data: JSON.stringify({ n: 3 }), created_at: now, deleted_at: null, created_by: 'test' },
            { id: deleted1, data: JSON.stringify({ n: 4 }), created_at: now, deleted_at: now, created_by: 'test' },
            { id: deleted2, data: JSON.stringify({ n: 5 }), created_at: now, deleted_at: now, created_by: 'test' },
        ]);

        const criteria = new Criteria(
            [{ field: 'deleted_at', operator: 'null', value: 'null', type: 'AND' }],
            null,
            0,
            0,
            null,
            TABLE_NAME
        );

        const data = await repository.getData(TABLE_NAME, ['id', 'data'], criteria);

        expect(data).toHaveLength(3);
        const returnedIds = data.map((r) => r.id);
        expect(returnedIds).toContain(active1);
        expect(returnedIds).toContain(active2);
        expect(returnedIds).toContain(active3);
        expect(returnedIds).not.toContain(deleted1);
        expect(returnedIds).not.toContain(deleted2);
    });

    it('deberia retornar vacio cuando todos los registros estan eliminados', async () => {
        const now = new Date();

        await repository.connection(TABLE_NAME).insert([
            { id: uuidv4(), data: JSON.stringify({ n: 1 }), created_at: now, deleted_at: now, created_by: 'test' },
            { id: uuidv4(), data: JSON.stringify({ n: 2 }), created_at: now, deleted_at: now, created_by: 'test' },
        ]);

        const criteria = new Criteria(
            [{ field: 'deleted_at', operator: 'null', value: 'null', type: 'AND' }],
            null,
            0,
            0,
            null,
            TABLE_NAME
        );

        const data = await repository.getData(TABLE_NAME, ['id', 'data'], criteria);

        expect(data).toHaveLength(0);
    });

    it('deberia tratar created_at como columna directa (no como campo JSONB)', async () => {
        const id = uuidv4();
        const now = new Date();

        await repository.connection(TABLE_NAME).insert({
            id,
            data: JSON.stringify({ nombre: 'Proveedor' }),
            created_at: now,
            deleted_at: null,
            created_by: 'test',
        });

        const criteria = new Criteria(
            [{ field: 'created_at', operator: 'notNull', value: 'null', type: 'AND' }],
            null,
            0,
            0,
            null,
            TABLE_NAME
        );

        const data = await repository.getData(TABLE_NAME, ['id', 'data'], criteria);

        expect(data).toHaveLength(1);
        expect(data[0].id).toBe(id);
    });

    it('deberia tratar deleted_by como columna directa al filtrar por null', async () => {
        const activeId = uuidv4();
        const deletedId = uuidv4();
        const now = new Date();

        await repository.connection(TABLE_NAME).insert([
            {
                id: activeId,
                data: JSON.stringify({ nombre: 'Sin deleted_by' }),
                created_at: now,
                deleted_at: null,
                deleted_by: null,
                created_by: 'test',
            },
            {
                id: deletedId,
                data: JSON.stringify({ nombre: 'Con deleted_by' }),
                created_at: now,
                deleted_at: now,
                deleted_by: 'admin',
                created_by: 'test',
            },
        ]);

        const criteria = new Criteria(
            [{ field: 'deleted_by', operator: 'null', value: 'null', type: 'AND' }],
            null,
            0,
            0,
            null,
            TABLE_NAME
        );

        const data = await repository.getData(TABLE_NAME, ['id', 'data'], criteria);

        expect(data).toHaveLength(1);
        expect(data[0].id).toBe(activeId);
    });
});
