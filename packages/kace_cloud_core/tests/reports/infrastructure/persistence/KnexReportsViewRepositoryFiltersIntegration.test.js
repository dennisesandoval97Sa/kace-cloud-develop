import { KnexReportsViewRepository } from '../../../../src/reports/infrastructure/persistence/KnexReportsViewRepository.js';
import { ValidationFailError, QueryDBError } from '../../../../src/shared/index.js';
import { UserFactory } from '../../../../src/factories/UserFactory.js';
import { knexConfig } from '../../../knexfile.js';

describe('KnexReportsViewRepository — filtros y operadores (integration)', () => {
    let repository;
    let ana;
    let bruno;
    let carla;

    const idsDe = (rows) => rows.map((row) => row.id);

    beforeAll(() => {
        repository = new KnexReportsViewRepository(knexConfig);
    });

    afterAll(async () => {
        await repository.destroyConnection();
    });

    beforeEach(async () => {
        const factory = new UserFactory(knexConfig);

        ana = await factory.create({
            nombres: 'Ana',
            email: 'ana@ejemplo.test',
            telefono: '3001112233',
            created_at: '2026-03-01T10:00:00.000Z',
        });
        bruno = await factory.create({
            nombres: 'Bruno',
            email: 'bruno@ejemplo.test',
            telefono: null,
            created_at: '2026-06-15T10:00:00.000Z',
        });
        carla = await factory.create({
            nombres: 'Carla',
            email: 'carla@ejemplo.test',
            telefono: '3004445566',
            created_at: '2026-09-30T10:00:00.000Z',
        });
    });

    describe('validateViewName', () => {
        it.each([
            ['cadena vacía', ''],
            ['null', null],
            ['no es cadena', 42],
            ['con espacio', 'mi vista'],
            ['con guion', 'mi-vista'],
            ['con punto y coma', 'usuarios; drop table usuarios'],
        ])('rechaza un nombre de vista %s', async (_caso, vista) => {
            await expect(repository.fetchViewDataWithConditions(vista, null, [])).rejects.toThrow(ValidationFailError);
        });
    });

    describe('operadores de igualdad y pertenencia', () => {
        it('equals devuelve solo la fila que coincide', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'email', operator: 'equals', value: 'ana@ejemplo.test' },
            ]);

            expect(idsDe(rows)).toEqual([ana.id.value]);
        });

        it('neq excluye la fila que coincide y conserva las demás', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'email', operator: 'neq', value: 'ana@ejemplo.test' },
            ]);

            expect(idsDe(rows)).not.toContain(ana.id.value);
            expect(idsDe(rows)).toContain(bruno.id.value);
        });

        it('in devuelve exactamente las filas enumeradas', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'email', operator: 'in', value: ['ana@ejemplo.test', 'bruno@ejemplo.test'] },
            ]);

            expect(idsDe(rows).sort()).toEqual([ana.id.value, bruno.id.value].sort());
        });

        it('notin excluye las filas enumeradas', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'email', operator: 'notin', value: ['ana@ejemplo.test', 'bruno@ejemplo.test'] },
            ]);

            expect(idsDe(rows)).not.toContain(ana.id.value);
            expect(idsDe(rows)).not.toContain(bruno.id.value);
            expect(idsDe(rows)).toContain(carla.id.value);
        });

        it('null devuelve las filas cuyo campo es nulo', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'telefono', operator: 'null' },
            ]);

            expect(idsDe(rows)).toContain(bruno.id.value);
            expect(idsDe(rows)).not.toContain(ana.id.value);
        });

        it('notnull devuelve las filas cuyo campo tiene valor', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'telefono', operator: 'notnull' },
            ]);

            expect(idsDe(rows)).toContain(ana.id.value);
            expect(idsDe(rows)).not.toContain(bruno.id.value);
        });

        it('usa equals cuando la condición no trae operador', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'email', value: 'carla@ejemplo.test' },
            ]);

            expect(idsDe(rows)).toEqual([carla.id.value]);
        });
    });

    describe('operadores de texto', () => {
        it('like distingue mayúsculas de minúsculas', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'nombres', operator: 'like', value: 'ANA' },
            ]);

            expect(idsDe(rows)).not.toContain(ana.id.value);
        });

        it('ilike ignora mayúsculas y minúsculas', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'nombres', operator: 'ilike', value: 'ANA' },
            ]);

            expect(idsDe(rows)).toContain(ana.id.value);
        });
    });

    describe('validación de operadores de lista', () => {
        it.each([
            ['array vacío', []],
            ['valor que no es array', 'no-soy-array'],
        ])('rechaza el operador in con %s', async (_caso, value) => {
            await expect(
                repository.fetchViewDataWithConditions('usuarios', null, [{ field: 'email', operator: 'in', value }])
            ).rejects.toThrow(ValidationFailError);
        });

        it.each([
            ['array vacío', []],
            ['valor que no es array', 'no-soy-array'],
        ])('rechaza el operador notin con %s', async (_caso, value) => {
            await expect(
                repository.fetchViewDataWithConditions('usuarios', null, [{ field: 'email', operator: 'notin', value }])
            ).rejects.toThrow(ValidationFailError);
        });
    });

    describe('operadores de comparación con normalización de fechas', () => {
        it.each([
            ['solo fecha con guiones', 'gte', '2026-06-01'],
            ['solo fecha con barras', 'gte', '2026/06/01'],
            ['fecha y hora sin zona', 'gte', '2026-06-01T00:00:00'],
            ['fecha con zona Z', 'gte', '2026-06-01T00:00:00Z'],
        ])('gte con %s deja fuera a la fila anterior al corte', async (_caso, operator, value) => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'created_at', operator, value },
            ]);

            expect(idsDe(rows)).not.toContain(ana.id.value);
            expect(idsDe(rows)).toContain(bruno.id.value);
            expect(idsDe(rows)).toContain(carla.id.value);
        });

        it('lte deja fuera a la fila posterior al corte', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'created_at', operator: 'lte', value: '2026-06-15' },
            ]);

            expect(idsDe(rows)).toContain(ana.id.value);
            expect(idsDe(rows)).toContain(bruno.id.value);
            expect(idsDe(rows)).not.toContain(carla.id.value);
        });

        it('gt deja fuera a la fila del propio corte y a las anteriores', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'created_at', operator: 'gt', value: '2026-06-15' },
            ]);

            expect(idsDe(rows)).not.toContain(ana.id.value);
            expect(idsDe(rows)).not.toContain(bruno.id.value);
            expect(idsDe(rows)).toContain(carla.id.value);
        });

        it('lt deja fuera a la fila del propio corte y a las posteriores', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'created_at', operator: 'lt', value: '2026-06-15' },
            ]);

            expect(idsDe(rows)).toContain(ana.id.value);
            expect(idsDe(rows)).not.toContain(bruno.id.value);
            expect(idsDe(rows)).not.toContain(carla.id.value);
        });

        it('deja intacto un valor que no es una fecha', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'nombres', operator: 'gt', value: 'Bruno' },
            ]);

            expect(idsDe(rows)).toContain(carla.id.value);
            expect(idsDe(rows)).not.toContain(ana.id.value);
        });
    });

    describe('operador between', () => {
        it('acepta un array [min, max] y devuelve las filas dentro del rango', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'created_at', operator: 'between', value: ['2026-05-01', '2026-07-01'] },
            ]);

            expect(idsDe(rows)).toContain(bruno.id.value);
            expect(idsDe(rows)).not.toContain(ana.id.value);
            expect(idsDe(rows)).not.toContain(carla.id.value);
        });

        it('acepta una cadena "min,max" separada por coma', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'created_at', operator: 'between', value: '2026-05-01,2026-07-01' },
            ]);

            expect(idsDe(rows)).toContain(bruno.id.value);
            expect(idsDe(rows)).not.toContain(ana.id.value);
            expect(idsDe(rows)).not.toContain(carla.id.value);
        });

        it('rechaza un rango que no trae exactamente dos valores', async () => {
            await expect(
                repository.fetchViewDataWithConditions('usuarios', null, [
                    { field: 'created_at', operator: 'between', value: ['2026-05-01'] },
                ])
            ).rejects.toThrow(ValidationFailError);
        });
    });

    describe('operador no soportado', () => {
        it('rechaza un operador desconocido', async () => {
            await expect(
                repository.fetchViewDataWithConditions('usuarios', null, [
                    { field: 'email', operator: 'contains-magic', value: 'ana' },
                ])
            ).rejects.toThrow(ValidationFailError);
        });
    });

    describe('condiciones combinadas con OR', () => {
        it('notnull en OR devuelve las filas cuyo campo tiene valor (índice 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'telefono', operator: 'notnull', type: 'OR' },
            ]);

            expect(idsDe(rows)).toContain(ana.id.value);
            expect(idsDe(rows)).toContain(carla.id.value);
            expect(idsDe(rows)).not.toContain(bruno.id.value);
        });

        it('notnull en OR devuelve las filas cuyo campo tiene valor (índice > 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'email', operator: 'equals', value: 'zzz-nadie@ejemplo.test', type: 'OR' },
                { field: 'telefono', operator: 'notnull', type: 'OR' },
            ]);

            expect(idsDe(rows)).toContain(ana.id.value);
            expect(idsDe(rows)).toContain(carla.id.value);
            expect(idsDe(rows)).not.toContain(bruno.id.value);
        });

        it('null en OR devuelve la fila cuyo campo es nulo (índice 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'telefono', operator: 'null', type: 'OR' },
            ]);

            expect(idsDe(rows)).toContain(bruno.id.value);
            expect(idsDe(rows)).not.toContain(ana.id.value);
            expect(idsDe(rows)).not.toContain(carla.id.value);
        });

        it('null en OR devuelve la fila cuyo campo es nulo (índice > 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'email', operator: 'equals', value: 'zzz-nadie@ejemplo.test', type: 'OR' },
                { field: 'telefono', operator: 'null', type: 'OR' },
            ]);

            expect(idsDe(rows)).toContain(bruno.id.value);
            expect(idsDe(rows)).not.toContain(ana.id.value);
            expect(idsDe(rows)).not.toContain(carla.id.value);
        });

        it('equals con valor null en OR devuelve la fila cuyo campo es nulo (índice 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'telefono', operator: 'equals', value: null, type: 'OR' },
            ]);

            expect(idsDe(rows)).toContain(bruno.id.value);
            expect(idsDe(rows)).not.toContain(ana.id.value);
            expect(idsDe(rows)).not.toContain(carla.id.value);
        });

        it('equals con valor null en OR devuelve la fila cuyo campo es nulo (índice > 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'email', operator: 'equals', value: 'zzz-nadie@ejemplo.test', type: 'OR' },
                { field: 'telefono', operator: 'equals', value: null, type: 'OR' },
            ]);

            expect(idsDe(rows)).toContain(bruno.id.value);
            expect(idsDe(rows)).not.toContain(ana.id.value);
            expect(idsDe(rows)).not.toContain(carla.id.value);
        });

        it('equals con valor no nulo en OR devuelve la fila que coincide (índice 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'email', operator: 'equals', value: 'ana@ejemplo.test', type: 'OR' },
            ]);

            expect(idsDe(rows)).toEqual([ana.id.value]);
        });

        it('equals con valor no nulo en OR devuelve la fila que coincide (índice > 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'email', operator: 'equals', value: 'zzz-nadie@ejemplo.test', type: 'OR' },
                { field: 'email', operator: 'equals', value: 'carla@ejemplo.test', type: 'OR' },
            ]);

            expect(idsDe(rows)).toEqual([carla.id.value]);
        });

        it('neq con valor null en OR devuelve las filas cuyo campo tiene valor (índice 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'telefono', operator: 'neq', value: null, type: 'OR' },
            ]);

            expect(idsDe(rows)).toContain(ana.id.value);
            expect(idsDe(rows)).toContain(carla.id.value);
            expect(idsDe(rows)).not.toContain(bruno.id.value);
        });

        it('neq con valor null en OR devuelve las filas cuyo campo tiene valor (índice > 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'email', operator: 'equals', value: 'zzz-nadie@ejemplo.test', type: 'OR' },
                { field: 'telefono', operator: 'neq', value: null, type: 'OR' },
            ]);

            expect(idsDe(rows)).toContain(ana.id.value);
            expect(idsDe(rows)).toContain(carla.id.value);
            expect(idsDe(rows)).not.toContain(bruno.id.value);
        });

        it('neq con valor no nulo en OR excluye la fila que coincide (índice 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'email', operator: 'neq', value: 'ana@ejemplo.test', type: 'OR' },
            ]);

            expect(idsDe(rows)).not.toContain(ana.id.value);
            expect(idsDe(rows)).toContain(bruno.id.value);
            expect(idsDe(rows)).toContain(carla.id.value);
        });

        it('neq con valor no nulo en OR excluye la fila que coincide (índice > 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'email', operator: 'equals', value: 'zzz-nadie@ejemplo.test', type: 'OR' },
                { field: 'email', operator: 'neq', value: 'ana@ejemplo.test', type: 'OR' },
            ]);

            expect(idsDe(rows)).not.toContain(ana.id.value);
            expect(idsDe(rows)).toContain(bruno.id.value);
            expect(idsDe(rows)).toContain(carla.id.value);
        });

        it('in en OR devuelve exactamente las filas enumeradas (índice 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'email', operator: 'in', value: ['ana@ejemplo.test', 'bruno@ejemplo.test'], type: 'OR' },
            ]);

            expect(idsDe(rows).sort()).toEqual([ana.id.value, bruno.id.value].sort());
        });

        it('in en OR devuelve exactamente las filas enumeradas (índice > 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'email', operator: 'equals', value: 'zzz-nadie@ejemplo.test', type: 'OR' },
                { field: 'email', operator: 'in', value: ['ana@ejemplo.test', 'bruno@ejemplo.test'], type: 'OR' },
            ]);

            expect(idsDe(rows).sort()).toEqual([ana.id.value, bruno.id.value].sort());
        });

        it('rechaza el operador in en OR con un valor que no es un array no vacío', async () => {
            await expect(
                repository.fetchViewDataWithConditions('usuarios', null, [
                    { field: 'email', operator: 'in', value: [], type: 'OR' },
                ])
            ).rejects.toThrow(ValidationFailError);
        });

        it('notin en OR excluye las filas enumeradas (índice 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'email', operator: 'notin', value: ['ana@ejemplo.test', 'bruno@ejemplo.test'], type: 'OR' },
            ]);

            expect(idsDe(rows)).toContain(carla.id.value);
            expect(idsDe(rows)).not.toContain(ana.id.value);
            expect(idsDe(rows)).not.toContain(bruno.id.value);
        });

        it('notin en OR excluye las filas enumeradas (índice > 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'email', operator: 'equals', value: 'zzz-nadie@ejemplo.test', type: 'OR' },
                { field: 'email', operator: 'notin', value: ['ana@ejemplo.test', 'bruno@ejemplo.test'], type: 'OR' },
            ]);

            expect(idsDe(rows)).toContain(carla.id.value);
            expect(idsDe(rows)).not.toContain(ana.id.value);
            expect(idsDe(rows)).not.toContain(bruno.id.value);
        });

        it('rechaza el operador notin en OR con un valor que no es un array no vacío', async () => {
            await expect(
                repository.fetchViewDataWithConditions('usuarios', null, [
                    { field: 'email', operator: 'notin', value: [], type: 'OR' },
                ])
            ).rejects.toThrow(ValidationFailError);
        });

        it('gt en OR deja fuera a la fila del propio corte y a las anteriores (índice 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'created_at', operator: 'gt', value: '2026-06-15', type: 'OR' },
            ]);

            expect(idsDe(rows)).toContain(carla.id.value);
            expect(idsDe(rows)).not.toContain(ana.id.value);
            expect(idsDe(rows)).not.toContain(bruno.id.value);
        });

        it('gt en OR deja fuera a la fila del propio corte y a las anteriores (índice > 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'email', operator: 'equals', value: 'zzz-nadie@ejemplo.test', type: 'OR' },
                { field: 'created_at', operator: 'gt', value: '2026-06-15', type: 'OR' },
            ]);

            expect(idsDe(rows)).toContain(carla.id.value);
            expect(idsDe(rows)).not.toContain(ana.id.value);
            expect(idsDe(rows)).not.toContain(bruno.id.value);
        });

        it('gte en OR deja fuera a la fila anterior al corte (índice 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'created_at', operator: 'gte', value: '2026-06-15', type: 'OR' },
            ]);

            expect(idsDe(rows)).not.toContain(ana.id.value);
            expect(idsDe(rows)).toContain(bruno.id.value);
            expect(idsDe(rows)).toContain(carla.id.value);
        });

        it('gte en OR deja fuera a la fila anterior al corte (índice > 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'email', operator: 'equals', value: 'zzz-nadie@ejemplo.test', type: 'OR' },
                { field: 'created_at', operator: 'gte', value: '2026-06-15', type: 'OR' },
            ]);

            expect(idsDe(rows)).not.toContain(ana.id.value);
            expect(idsDe(rows)).toContain(bruno.id.value);
            expect(idsDe(rows)).toContain(carla.id.value);
        });

        it('lt en OR deja fuera a la fila del propio corte y a las posteriores (índice 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'created_at', operator: 'lt', value: '2026-06-15', type: 'OR' },
            ]);

            expect(idsDe(rows)).toEqual([ana.id.value]);
        });

        it('lt en OR deja fuera a la fila del propio corte y a las posteriores (índice > 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'email', operator: 'equals', value: 'zzz-nadie@ejemplo.test', type: 'OR' },
                { field: 'created_at', operator: 'lt', value: '2026-06-15', type: 'OR' },
            ]);

            expect(idsDe(rows)).toEqual([ana.id.value]);
        });

        it('lte en OR deja fuera a la fila posterior al corte (índice 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'created_at', operator: 'lte', value: '2026-06-15', type: 'OR' },
            ]);

            expect(idsDe(rows)).toContain(ana.id.value);
            expect(idsDe(rows)).toContain(bruno.id.value);
            expect(idsDe(rows)).not.toContain(carla.id.value);
        });

        it('lte en OR deja fuera a la fila posterior al corte (índice > 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'email', operator: 'equals', value: 'zzz-nadie@ejemplo.test', type: 'OR' },
                { field: 'created_at', operator: 'lte', value: '2026-06-15', type: 'OR' },
            ]);

            expect(idsDe(rows)).toContain(ana.id.value);
            expect(idsDe(rows)).toContain(bruno.id.value);
            expect(idsDe(rows)).not.toContain(carla.id.value);
        });

        it('like en OR devuelve la fila cuyo texto coincide con el patrón (índice 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'nombres', operator: 'like', value: 'Ana', type: 'OR' },
            ]);

            expect(idsDe(rows)).toEqual([ana.id.value]);
        });

        it('like en OR devuelve la fila cuyo texto coincide con el patrón (índice > 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'email', operator: 'equals', value: 'zzz-nadie@ejemplo.test', type: 'OR' },
                { field: 'nombres', operator: 'like', value: 'Ana', type: 'OR' },
            ]);

            expect(idsDe(rows)).toEqual([ana.id.value]);
        });

        it('ilike en OR ignora mayúsculas y minúsculas (índice > 0, campo/valor distintos del test de regresión existente)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'email', operator: 'equals', value: 'zzz-nadie@ejemplo.test', type: 'OR' },
                { field: 'nombres', operator: 'ilike', value: 'ANA', type: 'OR' },
            ]);

            expect(idsDe(rows)).toContain(ana.id.value);
        });

        it('between en OR con array devuelve las filas dentro del rango (índice 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'created_at', operator: 'between', value: ['2026-05-01', '2026-07-01'], type: 'OR' },
            ]);

            expect(idsDe(rows)).toEqual([bruno.id.value]);
        });

        it('between en OR con array devuelve las filas dentro del rango (índice > 0)', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'email', operator: 'equals', value: 'zzz-nadie@ejemplo.test', type: 'OR' },
                { field: 'created_at', operator: 'between', value: ['2026-05-01', '2026-07-01'], type: 'OR' },
            ]);

            expect(idsDe(rows)).toEqual([bruno.id.value]);
        });

        it('between en OR acepta una cadena "min,max" separada por coma', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'created_at', operator: 'between', value: '2026-05-01,2026-07-01', type: 'OR' },
            ]);

            expect(idsDe(rows)).toEqual([bruno.id.value]);
        });

        it('rechaza el operador between en OR con un rango que no trae dos valores', async () => {
            await expect(
                repository.fetchViewDataWithConditions('usuarios', null, [
                    { field: 'created_at', operator: 'between', value: ['2026-05-01'], type: 'OR' },
                ])
            ).rejects.toThrow(ValidationFailError);
        });

        it('rechaza un operador desconocido en OR', async () => {
            await expect(
                repository.fetchViewDataWithConditions('usuarios', null, [
                    { field: 'email', operator: 'contains-magic', value: 'ana', type: 'OR' },
                ])
            ).rejects.toThrow(ValidationFailError);
        });

        it('combina AND con OR: el AND acota primero y el grupo OR acota dentro de ese subconjunto', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', null, [
                { field: 'telefono', operator: 'notnull', type: 'AND' },
                { field: 'email', operator: 'equals', value: 'ana@ejemplo.test', type: 'OR' },
            ]);

            expect(idsDe(rows)).toEqual([ana.id.value]);
        });
    });

    describe('periodo', () => {
        it.each([
            ['camelCase', { field: 'created_at', initialDate: '2026-05-01', endDate: '2026-07-01' }],
            ['snake_case', { field: 'created_at', initial_date: '2026-05-01', end_date: '2026-07-01' }],
        ])('acota por ambos extremos en %s', async (_caso, period) => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', period, []);

            expect(idsDe(rows)).toContain(bruno.id.value);
            expect(idsDe(rows)).not.toContain(ana.id.value);
            expect(idsDe(rows)).not.toContain(carla.id.value);
        });

        it('acota solo por el extremo inicial', async () => {
            const rows = await repository.fetchViewDataWithConditions(
                'usuarios',
                { field: 'created_at', initialDate: '2026-05-01' },
                []
            );

            expect(idsDe(rows)).not.toContain(ana.id.value);
            expect(idsDe(rows)).toContain(carla.id.value);
        });

        it('acota solo por el extremo final', async () => {
            const rows = await repository.fetchViewDataWithConditions(
                'usuarios',
                { field: 'created_at', endDate: '2026-05-01' },
                []
            );

            expect(idsDe(rows)).toContain(ana.id.value);
            expect(idsDe(rows)).not.toContain(carla.id.value);
        });

        it.each([
            ['periodo nulo', null],
            ['periodo sin campo', { initialDate: '2026-05-01', endDate: '2026-07-01' }],
            ['periodo sin fechas', { field: 'created_at' }],
        ])('ignora un %s y no filtra nada', async (_caso, period) => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', period, []);

            expect(idsDe(rows)).toContain(ana.id.value);
            expect(idsDe(rows)).toContain(bruno.id.value);
            expect(idsDe(rows)).toContain(carla.id.value);
        });

        it.each([
            ['con zona horaria', '2026-05-01T00:00:00Z'],
            ['con hora sin zona', '2026-05-01T00:00:00'],
        ])('acepta un extremo inicial %s', async (_caso, initialDate) => {
            const rows = await repository.fetchViewDataWithConditions(
                'usuarios',
                { field: 'created_at', initialDate },
                []
            );

            expect(idsDe(rows)).not.toContain(ana.id.value);
            expect(idsDe(rows)).toContain(carla.id.value);
        });

        it.each([
            ['con zona horaria', '2026-07-01T00:00:00Z'],
            ['con hora sin zona', '2026-07-01T00:00:00'],
        ])('acepta un extremo final %s', async (_caso, endDate) => {
            const rows = await repository.fetchViewDataWithConditions('usuarios', { field: 'created_at', endDate }, []);

            expect(idsDe(rows)).toContain(ana.id.value);
            expect(idsDe(rows)).toContain(bruno.id.value);
            expect(idsDe(rows)).not.toContain(carla.id.value);
        });
    });

    describe('streamViewDataWithConditions', () => {
        it('emite por el stream las mismas filas que devuelve la consulta directa', async () => {
            const stream = repository.streamViewDataWithConditions('usuarios', null, [
                { field: 'email', operator: 'equals', value: 'ana@ejemplo.test' },
            ]);

            const rows = [];
            for await (const row of stream) {
                rows.push(row);
            }

            expect(idsDe(rows)).toEqual([ana.id.value]);
        });

        it('lanza de forma síncrona si el nombre de vista no es válido', () => {
            expect(() => repository.streamViewDataWithConditions('mi-vista', null, [])).toThrow(ValidationFailError);
        });

        it('acepta un batchSize explícito y sigue emitiendo la fila esperada', async () => {
            const stream = repository.streamViewDataWithConditions(
                'usuarios',
                null,
                [{ field: 'email', operator: 'equals', value: 'ana@ejemplo.test' }],
                { batchSize: 10 }
            );

            const rows = [];
            for await (const row of stream) {
                rows.push(row);
            }

            expect(idsDe(rows)).toEqual([ana.id.value]);
        });
    });

    describe('parámetros por defecto', () => {
        it('fetchViewDataWithConditions funciona sin pasar period ni conditions', async () => {
            const rows = await repository.fetchViewDataWithConditions('usuarios');

            expect(idsDe(rows)).toContain(ana.id.value);
            expect(idsDe(rows)).toContain(bruno.id.value);
            expect(idsDe(rows)).toContain(carla.id.value);
        });
    });

    describe('errores no anticipados', () => {
        it('envuelve un error de base de datos que no es de validación en QueryDBError', async () => {
            await expect(
                repository.fetchViewDataWithConditions('usuarios', null, [
                    { field: 'columna_que_no_existe', operator: 'equals', value: 'x' },
                ])
            ).rejects.toThrow(QueryDBError);
        });
    });
});
