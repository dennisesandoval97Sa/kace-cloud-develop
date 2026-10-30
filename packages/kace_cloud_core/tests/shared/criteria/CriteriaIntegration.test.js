import { Ans, KnexAnsRepository } from '../../../src/ans/index.js';
import { Criteria } from '../../../src/shared/index.js';
import AnsMother from '../../ans/domain/AnsMother.js';
import { v4 as uuidv4 } from 'uuid';
import { KnexAuxiliariesRepository } from '../../../src/auxiliaries/infrastructure/persistence/KnexAuxiliariesRepository.js';
import { AuxiliaryMother } from '../../auxiliaries/domain/AuxiliaryMother.js';
import RoleMother from '../../role/domain/RoleMother.js';
import { KnexRoleRepository } from '../../../src/role/infrastructure/persistence/KnexRoleRepository.js';
import { knexConfig } from '../../knexfile.js';
import TestHelper from '../../TestHelper.js';

describe('CriteriaIntegration', () => {
    const repository = new KnexAnsRepository(knexConfig);
    const roleRepository = new KnexRoleRepository(knexConfig);
    const auxRepository = new KnexAuxiliariesRepository(knexConfig);

    beforeEach(async () => {
        await repository.connection.schema.dropTableIfExists('aux_proveedores');
        await repository.connection.schema.createTable('aux_proveedores', (table) => {
            table.string('id', 36).primary();
            table.jsonb('data').notNullable();
            table.timestamp('created_at');
            table.timestamp('updated_at');
            table.timestamp('deleted_at').nullable();
            table.string('created_by', 36);
            table.string('updated_by', 36);
            table.string('deleted_by', 36);
        });
    });

    afterEach(async () => {});

    test('can fetch data using criteriaConvertToKnex', async () => {
        await repository.connection.raw('TRUNCATE TABLE ans CASCADE');

        const criteria = new Criteria(
            undefined,
            undefined,
            10,
            0,
            {
                field: 'id',
                direction: 'asc',
            },
            'ans'
        );
        const ans = await AnsMother.createAns(repository);

        const queryFromCriteria = criteria.convertToKnex(repository.connection('ans').select('*'));
        const data = await queryFromCriteria.first();

        expect(data.id).toBe(ans.id.value);
    });

    test('can search using relationships', async () => {
        await repository.connection.raw('TRUNCATE TABLE ans CASCADE');

        const id = uuidv4();
        const role = await RoleMother.createRole(roleRepository);
        await repository.connection('usuarios').insert({
            id: id,
            login: 'test.sebas',
            is_active: 1,
            nombres: 'Sebas',
            apellido1: 'García',
            apellido2: 'Arias',
            email: 'sebas@mail.com',
            telefono: '123456789',
            movil: '31213213',
            rol_id: role.id.value,
        });

        const ansDto = AnsMother.dto();
        ansDto.created_by = id;
        const ans = await repository.save(new Ans(ansDto));

        const relationship = [
            {
                table: 'usuarios',
                condition: {
                    column: 'usuarios.id',
                    refColumn: 'ans.created_by',
                },
                type: 'join',
            },
        ];

        const criteria = new Criteria(
            undefined,
            relationship,
            10,
            0,
            {
                field: 'id',
                direction: 'asc',
            },
            'ans'
        );

        // todo: revisar el uso de alias para las columnas ya que los campos con el mismo nombre son descartados
        const queryFromCriteria = criteria.convertToKnex(repository.connection('ans').select('*'));
        const data = await queryFromCriteria.first();

        expect(data.nombres).toBe('Sebas');
    });

    test('should generate a query with AND conditions', async () => {
        const expectedQuery = repository
            .connection('ans')
            .select('*')
            .where('ans.color_ans_inicial', 'bg-green-300/20')
            .andWhere('ans.status', 1)
            .limit(100)
            .offset(0)
            .toQuery();

        const filters = [
            {
                field: 'color_ans_inicial',
                operator: 'eq',
                value: 'bg-green-300/20',
                type: 'and',
            },
            {
                field: 'status',
                operator: 'eq',
                value: 1,
                type: 'and',
            },
        ];

        const relationship = [];
        const limit = 100;
        const offset = 0;
        const criteria = new Criteria(filters, relationship, limit, offset, null, 'ans');
        const queryFromCriteria = criteria.convertToKnex(repository.connection('ans').select('*'));

        expect(queryFromCriteria.toQuery()).toEqual(expectedQuery);
    });

    test('should generate a query with OR conditions', async () => {
        const expectedQuery = repository
            .connection('ans')
            .select('*')
            .where('ans.color_ans_inicial', 'bg-green-300/20')
            .orWhere('ans.color_ans_inicial', 'bg-red-300/20')
            .limit(100)
            .offset(0)
            .toQuery();

        const filters = [
            {
                field: 'color_ans_inicial',
                operator: 'eq',
                value: 'bg-green-300/20',
                type: 'OR',
            },
            {
                field: 'color_ans_inicial',
                operator: 'eq',
                value: 'bg-red-300/20',
                type: 'OR',
            },
        ];

        const relationship = [];
        const limit = 100;
        const offset = 0;

        const criteria = new Criteria(filters, relationship, limit, offset, null, 'ans');
        const queryFromCriteria = criteria.convertToKnex(repository.connection('ans').select('*'));

        expect(queryFromCriteria.toQuery()).toEqual(expectedQuery);
    });

    test('should generate a query with mixed AND and OR conditions', async () => {
        const expectedQuery = repository
            .connection('ans')
            .select('*')
            .where('ans.color_ans_inicial', 'bg-green-300/20')
            .andWhere('ans.status', 1)
            .orWhere('ans.status', 2)
            .limit(100)
            .offset(0)
            .toQuery();

        const filters = [
            {
                field: 'color_ans_inicial',
                operator: 'eq',
                value: 'bg-green-300/20',
                type: 'AND',
            },
            {
                field: 'status',
                operator: 'eq',
                value: 1,
                type: 'AND',
            },
            {
                field: 'status',
                operator: 'eq',
                value: 2,
                type: 'OR',
            },
        ];

        const relationship = [];
        const limit = 100;
        const offset = 0;

        const criteria = new Criteria(filters, relationship, limit, offset, null, 'ans');
        const queryFromCriteria = criteria.convertToKnex(repository.connection('ans').select('*'));

        expect(queryFromCriteria.toQuery()).toEqual(expectedQuery);
    });

    test('should generate a query with JSON_CONTAINS operator', async () => {
        const expectedQuery = repository
            .connection('global_configurations')
            .select('*')
            .whereRaw(`??::jsonb @> ?::jsonb`, ['global_configurations.settings', { theme: 'dark' }])
            .limit(100)
            .offset(0)
            .toQuery();

        const filters = [
            {
                field: 'settings',
                operator: 'jsonContains',
                value: '{ "theme": "dark" }',
                type: 'AND',
            },
        ];

        const relationship = [];
        const limit = 100;
        const offset = 0;

        const criteria = new Criteria(filters, relationship, limit, offset, null, 'global_configurations');
        const queryFromCriteria = criteria.convertToKnex(repository.connection('global_configurations').select('*'));

        expect(queryFromCriteria.toQuery()).toEqual(expectedQuery);
    });

    test('should generate a query with JSON_ARRAY_VALUE operator', async () => {
        const expectedQuery = repository
            .connection('usuarios')
            .select('*')
            .whereRaw(`usuarios.codigos_externos::jsonb \\?| array['codigo1']`)
            .limit(100)
            .offset(0)
            .toQuery();

        const filters = [
            {
                field: 'codigos_externos',
                operator: 'jsonArrayValue',
                value: 'codigo1',
                type: 'AND',
            },
        ];

        const relationship = [];
        const limit = 100;
        const offset = 0;

        const criteria = new Criteria(filters, relationship, limit, offset, null, 'usuarios');
        const queryFromCriteria = criteria.convertToKnex(repository.connection('usuarios').select('*'));

        expect(queryFromCriteria.toQuery()).toEqual(expectedQuery);
    });

    test('should select ans and user especific fields', async () => {
        await repository.connection.raw('TRUNCATE TABLE ans CASCADE');

        const id = uuidv4();
        const role = await RoleMother.createRole(roleRepository);
        await repository.connection('usuarios').insert({
            id: id,
            login: 'test',
            is_active: 1,
            nombres: 'user',
            apellido1: 'one',
            email: 'user@mail.com',
            telefono: '123456789',
            movil: '31213213',
            rol_id: role.id.value,
        });

        const ansDto = AnsMother.dto();
        ansDto.created_by = id;
        await repository.save(new Ans(ansDto));

        const relationship = [
            {
                table: 'usuarios',
                condition: {
                    column: 'usuarios.id',
                    refColumn: 'ans.created_by',
                },
                type: 'join',
            },
        ];

        const selectFields = ['ans.intermedio', 'usuarios.nombres'];

        const criteria = new Criteria(
            undefined,
            relationship,
            10,
            0,
            {
                field: 'id',
                direction: 'asc',
            },
            'ans',
            selectFields
        );

        const queryFromCriteria = criteria.convertToKnex(repository.connection('ans').select('*'));

        const data = await queryFromCriteria.first();

        expect(data).toEqual({ intermedio: 5, nombres: 'user' });
    });

    test('should apply select, distinct, joins, groupBy, having, order, limit and offset together', async () => {
        await repository.connection.raw('TRUNCATE TABLE ans CASCADE');

        const userAId = uuidv4();
        const userBId = uuidv4();
        const userCId = uuidv4();

        const role = await RoleMother.createRole(roleRepository);
        await repository.connection('usuarios').insert([
            {
                id: userAId,
                login: 'userA',
                is_active: 1,
                nombres: 'Alice',
                apellido1: 'Doe',
                email: 'alice@mail.com',
                telefono: '1111',
                movil: '1234',
                rol_id: role.id.value,
            },
            {
                id: userBId,
                login: 'userB',
                is_active: 1,
                nombres: 'Bob',
                apellido1: 'Smith',
                email: 'bob@mail.com',
                telefono: '2222',
                movil: '5678',
                rol_id: role.id.value,
            },
            {
                id: userCId,
                login: 'userC',
                is_active: 1,
                nombres: 'Pepe',
                email: 'Pepe@mail.com',
                telefono: '3333',
                movil: '9012',
                rol_id: role.id.value,
            },
        ]);

        const ansA = AnsMother.dto();
        ansA.intermedio = 5;
        ansA.created_by = userAId;
        ansA.status = 1;
        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.intermedio = 10;
        ansB.created_by = userAId;
        ansB.status = 2;
        await repository.save(new Ans(ansB));

        const ansC = AnsMother.dto();
        ansC.intermedio = 15;
        ansC.created_by = userBId;
        ansC.status = 1;
        await repository.save(new Ans(ansC));

        const ansD = AnsMother.dto();
        ansD.intermedio = 20;
        ansD.created_by = userCId;
        ansD.status = 1;
        await repository.save(new Ans(ansD));

        const relationship = [
            {
                table: 'usuarios',
                condition: { column: 'usuarios.id', refColumn: 'ans.created_by' },
                type: 'join',
            },
        ];

        const selectFields = ['ans.intermedio', 'usuarios.nombres'];
        const filters = [
            {
                field: 'ans.status',
                operator: 'eq',
                value: 1,
                type: 'AND',
            },
        ];

        const groupBy = ['usuarios.nombres', 'usuarios.apellido1'];
        const having = [{ column: 'usuarios.apellido1', operator: 'notNull', value: null }];
        const order = { field: 'usuarios.nombres', direction: 'asc' };
        const limit = 5;
        const offset = 0;
        const distinct = true;

        const criteria = new Criteria(
            filters,
            relationship,
            limit,
            offset,
            order,
            'ans',
            selectFields,
            groupBy,
            having,
            distinct
        );

        const query = criteria.convertToKnex(repository.connection('ans').select('*'));

        const results = await query;
        expect(results.length).toBe(2);

        const nombres = results.map((r) => r.nombres);
        expect(nombres).toContain('Alice');
        expect(nombres).toContain('Bob');

        expect(Object.keys(results[0])).toEqual(expect.arrayContaining(['intermedio', 'nombres']));

        expect(nombres[0]).toBe('Alice');

        const sql = query.toSQL().sql;

        expect(sql.toLowerCase()).not.toContain('distinct');
        expect(sql.toLowerCase()).toContain('group by');
        expect(sql.toLowerCase()).toContain('having');
        expect(sql.toLowerCase()).toContain('order by');

        expect(results).toEqual([
            { intermedio: 5, nombres: 'Alice' },
            { intermedio: 15, nombres: 'Bob' },
        ]);
    });

    test('should apply select, joins, having, order, limit and offset with distinct', async () => {
        const relationship = [
            { table: 'usuarios', condition: { column: 'usuarios.id', refColumn: 'ans.created_by' }, type: 'join' },
        ];
        const selectFields = ['ans.intermedio', 'usuarios.nombres'];
        const filters = [{ field: 'ans.status', operator: 'eq', value: 1, type: 'AND' }];
        const having = [{ column: 'usuarios.nombres', operator: 'notNull', value: null }];
        const order = { field: 'usuarios.nombres', direction: 'asc' };
        const limit = 10;
        const offset = 0;
        const distinct = true;

        const criteria = new Criteria(
            filters,
            relationship,
            limit,
            offset,
            order,
            'ans',
            selectFields,
            null,
            having,
            distinct
        );

        const query = criteria.convertToKnex(repository.connection('ans').select('*'));
        const sql = query.toSQL().sql.toLowerCase();

        expect(sql).toContain('having');
        expect(sql).toContain('order by');
        expect(sql).toContain('distinct');
    });

    test('Order by must accept multiple fields and apply them', async () => {
        await repository.connection.raw('TRUNCATE TABLE ans CASCADE');

        const tableName = 'ans';
        const now = new Date();

        const ansA = AnsMother.dto();
        ansA.intermedio = 5;
        ansA.vencido = 10;
        ansA.created_at = new Date(now.getTime() - 3000).toISOString();
        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.intermedio = 5;
        ansB.vencido = 8;
        ansB.created_at = new Date(now.getTime() - 1000).toISOString();
        await repository.save(new Ans(ansB));

        const ansC = AnsMother.dto();
        ansC.intermedio = 10;
        ansC.vencido = 20;
        ansC.created_at = new Date(now.getTime() - 4000).toISOString();
        await repository.save(new Ans(ansC));

        const ansD = AnsMother.dto();
        ansD.intermedio = 10;
        ansD.vencido = 20;
        ansD.created_at = new Date(now.getTime() - 2000).toISOString();
        await repository.save(new Ans(ansD));

        const order = [
            { field: 'intermedio', direction: 'asc' },
            { field: 'vencido', direction: 'asc' },
            { field: 'created_at', direction: 'desc' },
        ];

        const criteria = new Criteria(null, null, null, null, order, tableName);

        const result = await repository.search(criteria);

        expect(result.map((r) => r.intermedio.value)).toEqual([5, 5, 10, 10]);
        expect(result.map((r) => r.vencido.value)).toEqual([8, 10, 20, 20]);

        const createdAts = result.map((r) => new Date(r.created_at.value).getTime());

        expect(createdAts).toEqual([
            new Date(now.getTime() - 1000).getTime(),
            new Date(now.getTime() - 3000).getTime(),
            new Date(now.getTime() - 2000).getTime(),
            new Date(now.getTime() - 4000).getTime(),
        ]);
    });

    test('Select must accept and apply count aggregate funcion', async () => {
        await repository.connection.raw('TRUNCATE TABLE ans CASCADE');

        const tableName = 'ans';
        const now = new Date();

        const ansA = AnsMother.dto();
        ansA.intermedio = 5;
        ansA.vencido = 10;
        ansA.created_at = new Date(now.getTime() - 3000).toISOString();
        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.intermedio = 5;
        ansB.vencido = 8;
        ansB.created_at = new Date(now.getTime() - 1000).toISOString();
        await repository.save(new Ans(ansB));

        const ansC = AnsMother.dto();
        ansC.intermedio = 10;
        ansC.vencido = 20;
        ansC.created_at = new Date(now.getTime() - 4000).toISOString();
        await repository.save(new Ans(ansC));

        const ansD = AnsMother.dto();
        ansD.intermedio = 10;
        ansD.vencido = 20;
        ansD.created_at = new Date(now.getTime() - 2000).toISOString();
        await repository.save(new Ans(ansD));

        const selectFields = [
            'ans.intermedio',
            {
                function: 'count',
                alias: 'total',
                field: 'ans.id',
            },
        ];

        const criteria = new Criteria(null, null, null, null, null, tableName, selectFields);

        const result = await repository.advancedSearch(criteria, tableName);

        expect(result).toHaveLength(2);
        result.forEach((r) => expect(r.total).toBe('2'));
        expect(result).toEqual(
            expect.arrayContaining([
                { intermedio: 5, total: '2' },
                { intermedio: 10, total: '2' },
            ])
        );
    });

    test('Select must accept and apply sum aggregate funcion', async () => {
        await repository.connection.raw('TRUNCATE TABLE ans CASCADE');

        const tableName = 'ans';
        const now = new Date();

        const ansA = AnsMother.dto();
        ansA.intermedio = 5;
        ansA.vencido = 10;
        ansA.created_at = new Date(now.getTime() - 3000).toISOString();
        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.intermedio = 5;
        ansB.vencido = 8;
        ansB.created_at = new Date(now.getTime() - 1000).toISOString();
        await repository.save(new Ans(ansB));

        const ansC = AnsMother.dto();
        ansC.intermedio = 10;
        ansC.vencido = 20;
        ansC.created_at = new Date(now.getTime() - 4000).toISOString();
        await repository.save(new Ans(ansC));

        const ansD = AnsMother.dto();
        ansD.intermedio = 10;
        ansD.vencido = 20;
        ansD.created_at = new Date(now.getTime() - 2000).toISOString();
        await repository.save(new Ans(ansD));

        const selectFields = [
            'ans.intermedio',
            {
                function: 'sum',
                alias: 'total',
                field: 'ans.vencido',
            },
        ];

        const criteria = new Criteria(null, null, null, null, null, tableName, selectFields);

        const result = await repository.advancedSearch(criteria, tableName);

        expect(result).toHaveLength(2);
        expect(result).toEqual(
            expect.arrayContaining([
                { intermedio: 5, total: '18' },
                { intermedio: 10, total: '40' },
            ])
        );
    });

    test('Select must accept and apply avg aggregate funcion', async () => {
        await repository.connection.raw('TRUNCATE TABLE ans CASCADE');

        const tableName = 'ans';
        const now = new Date();

        const ansA = AnsMother.dto();
        ansA.intermedio = 5;
        ansA.vencido = 10;
        ansA.created_at = new Date(now.getTime() - 3000).toISOString();
        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.intermedio = 5;
        ansB.vencido = 8;
        ansB.created_at = new Date(now.getTime() - 1000).toISOString();
        await repository.save(new Ans(ansB));

        const ansC = AnsMother.dto();
        ansC.intermedio = 10;
        ansC.vencido = 20;
        ansC.created_at = new Date(now.getTime() - 4000).toISOString();
        await repository.save(new Ans(ansC));

        const ansD = AnsMother.dto();
        ansD.intermedio = 10;
        ansD.vencido = 20;
        ansD.created_at = new Date(now.getTime() - 2000).toISOString();
        await repository.save(new Ans(ansD));

        const selectFields = [
            'ans.intermedio',
            {
                function: 'avg',
                alias: 'average',
                field: 'ans.vencido',
            },
        ];

        const criteria = new Criteria(null, null, null, null, null, tableName, selectFields);

        const result = await repository.advancedSearch(criteria, tableName);

        expect(result).toHaveLength(2);
        expect(result).toEqual(
            expect.arrayContaining([
                { intermedio: 5, average: '9.0000000000000000' },
                { intermedio: 10, average: '20.0000000000000000' },
            ])
        );
    });

    test('Select must accept and apply min aggregate funcion', async () => {
        const tableName = 'ans';
        const now = new Date();

        const ansA = AnsMother.dto();
        ansA.intermedio = 5;
        ansA.vencido = 10;
        ansA.created_at = new Date(now.getTime() - 3000).toISOString();
        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.intermedio = 5;
        ansB.vencido = 8;
        ansB.created_at = new Date(now.getTime() - 1000).toISOString();
        await repository.save(new Ans(ansB));

        const ansC = AnsMother.dto();
        ansC.intermedio = 10;
        ansC.vencido = 20;
        ansC.created_at = new Date(now.getTime() - 4000).toISOString();
        await repository.save(new Ans(ansC));

        const ansD = AnsMother.dto();
        ansD.intermedio = 10;
        ansD.vencido = 20;
        ansD.created_at = new Date(now.getTime() - 2000).toISOString();
        await repository.save(new Ans(ansD));

        const selectFields = [
            'ans.intermedio',
            {
                function: 'min',
                alias: 'minimum',
                field: 'ans.vencido',
            },
        ];

        const criteria = new Criteria(null, null, null, null, null, tableName, selectFields);

        const result = await repository.advancedSearch(criteria, tableName);

        expect(result).toHaveLength(2);
        expect(result).toEqual(
            expect.arrayContaining([
                { intermedio: 5, minimum: 8 },
                { intermedio: 10, minimum: 20 },
            ])
        );
    });

    test('Select must accept and apply max aggregate funcion', async () => {
        const tableName = 'ans';
        const now = new Date();

        const ansA = AnsMother.dto();
        ansA.intermedio = 5;
        ansA.vencido = 10;
        ansA.created_at = new Date(now.getTime() - 3000).toISOString();
        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.intermedio = 5;
        ansB.vencido = 8;
        ansB.created_at = new Date(now.getTime() - 1000).toISOString();
        await repository.save(new Ans(ansB));

        const ansC = AnsMother.dto();
        ansC.intermedio = 10;
        ansC.vencido = 20;
        ansC.created_at = new Date(now.getTime() - 4000).toISOString();
        await repository.save(new Ans(ansC));

        const ansD = AnsMother.dto();
        ansD.intermedio = 10;
        ansD.vencido = 20;
        ansD.created_at = new Date(now.getTime() - 2000).toISOString();
        await repository.save(new Ans(ansD));

        const selectFields = [
            'ans.intermedio',
            {
                function: 'max',
                alias: 'maximum',
                field: 'ans.vencido',
            },
        ];

        const criteria = new Criteria(null, null, null, null, null, tableName, selectFields);

        const result = await repository.advancedSearch(criteria, tableName);

        expect(result).toHaveLength(2);
        expect(result).toEqual(
            expect.arrayContaining([
                { intermedio: 5, maximum: 10 },
                { intermedio: 10, maximum: 20 },
            ])
        );
    });

    test('Select must accept a having condition with aggregate max function', async () => {
        const tableName = 'ans';
        const now = new Date();

        const ansA = AnsMother.dto();
        ansA.intermedio = 5;
        ansA.vencido = 10;
        ansA.created_at = new Date(now.getTime() - 3000).toISOString();
        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.intermedio = 5;
        ansB.vencido = 8;
        ansB.created_at = new Date(now.getTime() - 1000).toISOString();
        await repository.save(new Ans(ansB));

        const ansC = AnsMother.dto();
        ansC.intermedio = 10;
        ansC.vencido = 20;
        ansC.created_at = new Date(now.getTime() - 4000).toISOString();
        await repository.save(new Ans(ansC));

        const ansD = AnsMother.dto();
        ansD.intermedio = 10;
        ansD.vencido = 20;
        ansD.created_at = new Date(now.getTime() - 2000).toISOString();
        await repository.save(new Ans(ansD));

        const selectFields = [
            'ans.intermedio',
            {
                function: 'max',
                alias: 'maximum',
                field: 'ans.vencido',
            },
        ];

        const having = [{ column: `${selectFields[1].function}(${selectFields[1].field})`, operator: 'gt', value: 10 }];
        const criteria = new Criteria(null, null, null, null, null, tableName, selectFields, null, having);

        const result = await repository.advancedSearch(criteria, tableName);

        expect(result).toHaveLength(1);
        expect(result).toEqual(expect.arrayContaining([{ intermedio: 10, maximum: 20 }]));
    });

    test('Select must accept a having condition with aggregate max function and eq operator', async () => {
        const tableName = 'ans';
        const now = new Date();

        const ansA = AnsMother.dto();
        ansA.intermedio = 5;
        ansA.vencido = 10;
        ansA.created_at = new Date(now.getTime() - 3000).toISOString();
        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.intermedio = 5;
        ansB.vencido = 8;
        ansB.created_at = new Date(now.getTime() - 1000).toISOString();
        await repository.save(new Ans(ansB));

        const ansC = AnsMother.dto();
        ansC.intermedio = 10;
        ansC.vencido = 20;
        ansC.created_at = new Date(now.getTime() - 4000).toISOString();
        await repository.save(new Ans(ansC));

        const ansD = AnsMother.dto();
        ansD.intermedio = 10;
        ansD.vencido = 20;
        ansD.created_at = new Date(now.getTime() - 2000).toISOString();
        await repository.save(new Ans(ansD));

        const selectFields = [
            'ans.intermedio',
            {
                function: 'max',
                alias: 'maximum',
                field: 'ans.vencido',
            },
        ];

        const having = [{ column: `${selectFields[1].function}(${selectFields[1].field})`, operator: 'eq', value: 20 }];
        const criteria = new Criteria(null, null, null, null, null, tableName, selectFields, null, having);

        const result = await repository.advancedSearch(criteria, tableName);

        expect(result).toHaveLength(1);
        expect(result).toEqual(expect.arrayContaining([{ intermedio: 10, maximum: 20 }]));
    });

    test('Select must accept a having condition with aggregate max function and neq operator', async () => {
        const tableName = 'ans';
        const now = new Date();

        const ansA = AnsMother.dto();
        ansA.intermedio = 5;
        ansA.vencido = 10;
        ansA.created_at = new Date(now.getTime() - 3000).toISOString();
        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.intermedio = 5;
        ansB.vencido = 8;
        ansB.created_at = new Date(now.getTime() - 1000).toISOString();
        await repository.save(new Ans(ansB));

        const ansC = AnsMother.dto();
        ansC.intermedio = 10;
        ansC.vencido = 20;
        ansC.created_at = new Date(now.getTime() - 4000).toISOString();
        await repository.save(new Ans(ansC));

        const ansD = AnsMother.dto();
        ansD.intermedio = 10;
        ansD.vencido = 20;
        ansD.created_at = new Date(now.getTime() - 2000).toISOString();
        await repository.save(new Ans(ansD));

        const selectFields = [
            'ans.intermedio',
            {
                function: 'max',
                alias: 'maximum',
                field: 'ans.vencido',
            },
        ];

        const having = [
            { column: `${selectFields[1].function}(${selectFields[1].field})`, operator: 'neq', value: 10 },
        ];
        const criteria = new Criteria(null, null, null, null, null, tableName, selectFields, null, having);

        const result = await repository.advancedSearch(criteria, tableName);

        expect(result).toHaveLength(1);
        expect(result).toEqual(expect.arrayContaining([{ intermedio: 10, maximum: 20 }]));
    });

    test('Select must accept a having condition with aggregate max function and gte operator', async () => {
        const tableName = 'ans';
        const now = new Date();

        const ansA = AnsMother.dto();
        ansA.intermedio = 5;
        ansA.vencido = 10;
        ansA.created_at = new Date(now.getTime() - 3000).toISOString();
        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.intermedio = 5;
        ansB.vencido = 8;
        ansB.created_at = new Date(now.getTime() - 1000).toISOString();
        await repository.save(new Ans(ansB));

        const ansC = AnsMother.dto();
        ansC.intermedio = 10;
        ansC.vencido = 20;
        ansC.created_at = new Date(now.getTime() - 4000).toISOString();
        await repository.save(new Ans(ansC));

        const ansD = AnsMother.dto();
        ansD.intermedio = 10;
        ansD.vencido = 20;
        ansD.created_at = new Date(now.getTime() - 2000).toISOString();
        await repository.save(new Ans(ansD));

        const selectFields = [
            'ans.intermedio',
            {
                function: 'max',
                alias: 'maximum',
                field: 'ans.vencido',
            },
        ];

        const having = [
            { column: `${selectFields[1].function}(${selectFields[1].field})`, operator: 'gte', value: 10 },
        ];
        const criteria = new Criteria(null, null, null, null, null, tableName, selectFields, null, having);

        const result = await repository.advancedSearch(criteria, tableName);

        expect(result).toHaveLength(2);
        expect(result).toEqual(
            expect.arrayContaining([
                { intermedio: 5, maximum: 10 },
                { intermedio: 10, maximum: 20 },
            ])
        );
    });

    test('Select must accept a having condition with aggregate max function and lt operator', async () => {
        const tableName = 'ans';
        const now = new Date();

        const ansA = AnsMother.dto();
        ansA.intermedio = 5;
        ansA.vencido = 10;
        ansA.created_at = new Date(now.getTime() - 3000).toISOString();
        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.intermedio = 5;
        ansB.vencido = 8;
        ansB.created_at = new Date(now.getTime() - 1000).toISOString();
        await repository.save(new Ans(ansB));

        const ansC = AnsMother.dto();
        ansC.intermedio = 10;
        ansC.vencido = 20;
        ansC.created_at = new Date(now.getTime() - 4000).toISOString();
        await repository.save(new Ans(ansC));

        const ansD = AnsMother.dto();
        ansD.intermedio = 10;
        ansD.vencido = 20;
        ansD.created_at = new Date(now.getTime() - 2000).toISOString();
        await repository.save(new Ans(ansD));

        const selectFields = [
            'ans.intermedio',
            {
                function: 'max',
                alias: 'maximum',
                field: 'ans.vencido',
            },
        ];

        const having = [{ column: `${selectFields[1].function}(${selectFields[1].field})`, operator: 'lt', value: 20 }];
        const criteria = new Criteria(null, null, null, null, null, tableName, selectFields, null, having);

        const result = await repository.advancedSearch(criteria, tableName);

        expect(result).toHaveLength(1);
        expect(result).toEqual(expect.arrayContaining([{ intermedio: 5, maximum: 10 }]));
    });

    test('Select must accept a having condition with aggregate max function and lte operator', async () => {
        const tableName = 'ans';
        const now = new Date();

        const ansA = AnsMother.dto();
        ansA.intermedio = 5;
        ansA.vencido = 10;
        ansA.created_at = new Date(now.getTime() - 3000).toISOString();
        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.intermedio = 5;
        ansB.vencido = 8;
        ansB.created_at = new Date(now.getTime() - 1000).toISOString();
        await repository.save(new Ans(ansB));

        const ansC = AnsMother.dto();
        ansC.intermedio = 10;
        ansC.vencido = 20;
        ansC.created_at = new Date(now.getTime() - 4000).toISOString();
        await repository.save(new Ans(ansC));

        const ansD = AnsMother.dto();
        ansD.intermedio = 10;
        ansD.vencido = 20;
        ansD.created_at = new Date(now.getTime() - 2000).toISOString();
        await repository.save(new Ans(ansD));

        const selectFields = [
            'ans.intermedio',
            {
                function: 'max',
                alias: 'maximum',
                field: 'ans.vencido',
            },
        ];

        const having = [
            { column: `${selectFields[1].function}(${selectFields[1].field})`, operator: 'lte', value: 10 },
        ];
        const criteria = new Criteria(null, null, null, null, null, tableName, selectFields, null, having);

        const result = await repository.advancedSearch(criteria, tableName);

        expect(result).toHaveLength(1);
        expect(result).toEqual(expect.arrayContaining([{ intermedio: 5, maximum: 10 }]));
    });

    test('Select must accept a having condition with aggregate max function and between operator', async () => {
        const tableName = 'ans';
        const now = new Date();

        const ansA = AnsMother.dto();
        ansA.intermedio = 5;
        ansA.vencido = 10;
        ansA.created_at = new Date(now.getTime() - 3000).toISOString();
        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.intermedio = 5;
        ansB.vencido = 8;
        ansB.created_at = new Date(now.getTime() - 1000).toISOString();
        await repository.save(new Ans(ansB));

        const ansC = AnsMother.dto();
        ansC.intermedio = 10;
        ansC.vencido = 20;
        ansC.created_at = new Date(now.getTime() - 4000).toISOString();
        await repository.save(new Ans(ansC));

        const ansD = AnsMother.dto();
        ansD.intermedio = 10;
        ansD.vencido = 20;
        ansD.created_at = new Date(now.getTime() - 2000).toISOString();
        await repository.save(new Ans(ansD));

        const selectFields = [
            'ans.intermedio',
            {
                function: 'max',
                alias: 'maximum',
                field: 'ans.vencido',
            },
        ];

        const having = [
            { column: `${selectFields[1].function}(${selectFields[1].field})`, operator: 'between', value: [5, 15] },
        ];
        const criteria = new Criteria(null, null, null, null, null, tableName, selectFields, null, having);

        const result = await repository.advancedSearch(criteria, tableName);

        expect(result).toHaveLength(1);
        expect(result).toEqual(expect.arrayContaining([{ intermedio: 5, maximum: 10 }]));
    });

    test('Select must accept a having condition with aggregate max function and in operator', async () => {
        const tableName = 'ans';
        const now = new Date();

        const ansA = AnsMother.dto();
        ansA.intermedio = 5;
        ansA.vencido = 10;
        ansA.created_at = new Date(now.getTime() - 3000).toISOString();
        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.intermedio = 5;
        ansB.vencido = 8;
        ansB.created_at = new Date(now.getTime() - 1000).toISOString();
        await repository.save(new Ans(ansB));

        const ansC = AnsMother.dto();
        ansC.intermedio = 10;
        ansC.vencido = 20;
        ansC.created_at = new Date(now.getTime() - 4000).toISOString();
        await repository.save(new Ans(ansC));

        const ansD = AnsMother.dto();
        ansD.intermedio = 10;
        ansD.vencido = 20;
        ansD.created_at = new Date(now.getTime() - 2000).toISOString();
        await repository.save(new Ans(ansD));

        const selectFields = [
            'ans.intermedio',
            {
                function: 'max',
                alias: 'maximum',
                field: 'ans.vencido',
            },
        ];

        const having = [
            { column: `${selectFields[1].function}(${selectFields[1].field})`, operator: 'in', value: [10, 20] },
        ];
        const criteria = new Criteria(null, null, null, null, null, tableName, selectFields, null, having);

        const result = await repository.advancedSearch(criteria, tableName);

        expect(result).toHaveLength(2);
        expect(result).toEqual(
            expect.arrayContaining([
                { intermedio: 5, maximum: 10 },
                { intermedio: 10, maximum: 20 },
            ])
        );
    });

    test('Select must accept a having condition with aggregate max function and notIn operator', async () => {
        const tableName = 'ans';
        const now = new Date();

        const ansA = AnsMother.dto();
        ansA.intermedio = 5;
        ansA.vencido = 10;
        ansA.created_at = new Date(now.getTime() - 3000).toISOString();
        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.intermedio = 5;
        ansB.vencido = 8;
        ansB.created_at = new Date(now.getTime() - 1000).toISOString();
        await repository.save(new Ans(ansB));

        const ansC = AnsMother.dto();
        ansC.intermedio = 10;
        ansC.vencido = 20;
        ansC.created_at = new Date(now.getTime() - 4000).toISOString();
        await repository.save(new Ans(ansC));

        const ansD = AnsMother.dto();
        ansD.intermedio = 10;
        ansD.vencido = 20;
        ansD.created_at = new Date(now.getTime() - 2000).toISOString();
        await repository.save(new Ans(ansD));

        const selectFields = [
            'ans.intermedio',
            {
                function: 'max',
                alias: 'maximum',
                field: 'ans.vencido',
            },
        ];

        const having = [
            { column: `${selectFields[1].function}(${selectFields[1].field})`, operator: 'notIn', value: [10] },
        ];
        const criteria = new Criteria(null, null, null, null, null, tableName, selectFields, null, having);

        const result = await repository.advancedSearch(criteria, tableName);

        expect(result).toHaveLength(1);
        expect(result).toEqual(expect.arrayContaining([{ intermedio: 10, maximum: 20 }]));
    });

    test('Select must accept a having condition with aggregate max function and like operator', async () => {
        const tableName = 'ans';
        const now = new Date();

        const ansA = AnsMother.dto();
        ansA.intermedio = 5;
        ansA.vencido = 10;
        ansA.created_at = new Date(now.getTime() - 3000).toISOString();
        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.intermedio = 5;
        ansB.vencido = 8;
        ansB.created_at = new Date(now.getTime() - 1000).toISOString();
        await repository.save(new Ans(ansB));

        const ansC = AnsMother.dto();
        ansC.intermedio = 10;
        ansC.vencido = 20;
        ansC.created_at = new Date(now.getTime() - 4000).toISOString();
        await repository.save(new Ans(ansC));

        const ansD = AnsMother.dto();
        ansD.intermedio = 10;
        ansD.vencido = 20;
        ansD.created_at = new Date(now.getTime() - 2000).toISOString();
        await repository.save(new Ans(ansD));

        const selectFields = [
            'ans.intermedio',
            {
                function: 'max',
                alias: 'maximum',
                field: 'ans.vencido',
            },
        ];

        const having = [
            { column: `${selectFields[1].function}(${selectFields[1].field})`, operator: 'eq', value: '20' },
        ];
        const criteria = new Criteria(null, null, null, null, null, tableName, selectFields, null, having);

        const result = await repository.advancedSearch(criteria, tableName);

        expect(result).toHaveLength(1);
        expect(result).toEqual(expect.arrayContaining([{ intermedio: 10, maximum: 20 }]));
    });

    test('Select must accept a having condition with aggregate max function and null operator', async () => {
        const tableName = 'ans';
        const now = new Date();

        const ansA = AnsMother.dto();
        ansA.intermedio = 5;
        ansA.vencido = 10;
        ansA.created_at = new Date(now.getTime() - 3000).toISOString();
        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.intermedio = 5;
        ansB.vencido = 8;
        ansB.created_at = new Date(now.getTime() - 1000).toISOString();
        await repository.save(new Ans(ansB));

        const ansC = AnsMother.dto();
        ansC.intermedio = 10;
        ansC.vencido = 20;
        ansC.created_at = new Date(now.getTime() - 4000).toISOString();
        await repository.save(new Ans(ansC));

        const ansD = AnsMother.dto();
        ansD.intermedio = 10;
        ansD.vencido = 20;
        ansD.created_at = new Date(now.getTime() - 2000).toISOString();
        await repository.save(new Ans(ansD));

        const selectFields = [
            'ans.intermedio',
            {
                function: 'max',
                alias: 'maximum',
                field: 'ans.vencido',
            },
        ];

        const having = [
            { column: `${selectFields[1].function}(${selectFields[1].field})`, operator: 'null', value: null },
        ];
        const criteria = new Criteria(null, null, null, null, null, tableName, selectFields, null, having);

        const result = await repository.advancedSearch(criteria, tableName);

        expect(result).toHaveLength(0);
    });

    test('Select must accept a having condition with aggregate max function and notNull operator', async () => {
        const tableName = 'ans';
        const now = new Date();

        const ansA = AnsMother.dto();
        ansA.intermedio = 5;
        ansA.vencido = 10;
        ansA.created_at = new Date(now.getTime() - 3000).toISOString();
        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.intermedio = 5;
        ansB.vencido = 8;
        ansB.created_at = new Date(now.getTime() - 1000).toISOString();
        await repository.save(new Ans(ansB));

        const ansC = AnsMother.dto();
        ansC.intermedio = 10;
        ansC.vencido = 20;
        ansC.created_at = new Date(now.getTime() - 4000).toISOString();
        await repository.save(new Ans(ansC));

        const ansD = AnsMother.dto();
        ansD.intermedio = 10;
        ansD.vencido = 20;
        ansD.created_at = new Date(now.getTime() - 2000).toISOString();
        await repository.save(new Ans(ansD));

        const selectFields = [
            'ans.intermedio',
            {
                function: 'max',
                alias: 'maximum',
                field: 'ans.vencido',
            },
        ];

        const having = [
            { column: `${selectFields[1].function}(${selectFields[1].field})`, operator: 'notNull', value: null },
        ];
        const criteria = new Criteria(null, null, null, null, null, tableName, selectFields, null, having);

        const result = await repository.advancedSearch(criteria, tableName);

        expect(result).toHaveLength(2);
        expect(result).toEqual(
            expect.arrayContaining([
                { intermedio: 5, maximum: 10 },
                { intermedio: 10, maximum: 20 },
            ])
        );
    });

    test('Se agrupan los filtros en OR y AND correctamente', async () => {
        const tableName = 'ans';

        const ansA = AnsMother.dto();
        ansA.vencido = 15;
        ansA.intermedio = 5;
        ansA.created_at = '2025-06-15';
        ansA.updated_at = '2025-06-15';
        ansA.deleted_at = null;
        await repository.save(new Ans(ansA));

        //ESTE NO ENTRARIA EN LOS ORS
        const ansB = AnsMother.dto();
        ansB.vencido = null;
        ansB.intermedio = null;
        ansB.created_at = '2021-06-15';
        ansB.updated_at = '2024-06-15';
        ansB.deleted_at = null;
        await repository.save(new Ans(ansB));

        const ansC = AnsMother.dto();
        ansC.vencido = 8;
        ansC.intermedio = 5;
        ansC.created_at = '2022-06-15';
        ansC.deleted_at = null;
        await repository.save(new Ans(ansC));

        //ESTE NO ENTRARIA POR ELIMINADO
        const ansD = AnsMother.dto();
        ansD.vencido = 15;
        ansD.intermedio = 20;
        ansD.created_at = '2021-06-15';
        ansD.deleted_at = '2021-06-15';
        await repository.save(new Ans(ansD));

        const payload = {
            filter: [
                {
                    field: 'updated_at',
                    operator: 'between',
                    value: '2025-01-01, 2025-12-31',
                    type: 'OR',
                },
                {
                    groupType: 'OR',
                    filters: [
                        { field: 'created_at', operator: 'between', value: '2022-01-01, 2022-12-31', type: 'OR' },
                    ],
                },
                {
                    groupType: 'OR',
                    filters: [
                        { field: 'vencido', operator: 'notNull', value: 'null', type: 'AND' },
                        { field: 'vencido', operator: 'gt', value: 10, type: 'AND' },
                    ],
                },
                {
                    groupType: 'AND',
                    filters: [
                        { field: 'intermedio', operator: 'notNull', value: 'null', type: 'AND' },
                        { field: 'intermedio', operator: 'lt', value: 15, type: 'AND' },
                    ],
                },
                {
                    field: 'deleted_at',
                    operator: 'null',
                    value: 'null',
                    type: 'AND',
                },
            ],
        };

        const criteria = new Criteria(
            payload.filter,
            payload.relationship,
            payload.limit,
            payload.offset,
            payload.order,
            tableName
        );

        const result = await repository.advancedSearch(criteria, tableName);

        // Deben pasar solo A y C
        expect(result).toHaveLength(2);

        const ids = result.map((r) => r.id);
        expect(ids).toContain(ansA.id);
        expect(ids).toContain(ansC.id);
    });

    test('should apply two users relations with diferents users and return the correct users name selected', async () => {
        await repository.connection.raw('TRUNCATE TABLE ans CASCADE');

        const userAId = uuidv4();
        const userBId = uuidv4();

        const role = await RoleMother.createRole(roleRepository);
        await repository.connection('usuarios').insert([
            {
                id: userAId,
                login: 'userA',
                is_active: 1,
                nombres: 'Alice',
                apellido1: 'Doe',
                email: 'alice@mail.com',
                telefono: '1111',
                movil: '1234',
                rol_id: role.id.value,
            },
            {
                id: userBId,
                login: 'userB',
                is_active: 1,
                nombres: 'Bob',
                apellido1: 'Smith',
                email: 'bob@mail.com',
                telefono: '2222',
                movil: '5678',
                rol_id: role.id.value,
            },
        ]);

        const ansA = AnsMother.dto();
        ansA.intermedio = 5;
        ansA.created_by = userAId;
        ansA.updated_by = userBId;
        ansA.status = 1;
        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.intermedio = 10;
        ansB.created_by = userBId;
        ansB.updated_by = userAId;
        ansB.status = 2;
        await repository.save(new Ans(ansB));

        const relationship = [
            {
                table: 'usuarios as u',
                condition: { column: 'u.id', refColumn: 'ans.created_by' },
                type: 'left',
            },
            {
                table: 'usuarios as u2',
                condition: { column: 'u2.id', refColumn: 'ans.updated_by' },
                type: 'left',
            },
        ];

        const selectFields = ['ans.intermedio', 'u.nombres as created_by', 'u2.nombres as updated_by'];

        const criteria = new Criteria(null, relationship, 10, 0, null, 'ans', selectFields, null, null, null);

        const query = criteria.convertToKnex(repository.connection('ans').select('*'));

        const results = await query;
        expect(results.length).toBe(2);

        expect(results).toEqual([
            { intermedio: 5, created_by: 'Alice', updated_by: 'Bob' },
            { intermedio: 10, created_by: 'Bob', updated_by: 'Alice' },
        ]);
    });

    test('Select must accept a compartions functions', async () => {
        await repository.connection.raw('TRUNCATE TABLE ans CASCADE');

        const tableName = 'ans';
        const now = new Date();
        const DAY = 24 * 60 * 60 * 1000;

        const ansA = AnsMother.dto();
        ansA.created_at = new Date(now.getTime() - 3 * DAY).toISOString();
        ansA.updated_at = new Date(now.getTime() - 1 * DAY).toISOString();
        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.created_at = new Date(now.getTime() - 2 * DAY).toISOString();
        ansB.updated_at = new Date(now.getTime() - 1 * DAY).toISOString();
        await repository.save(new Ans(ansB));

        const ansC = AnsMother.dto();
        ansC.created_at = new Date(now.getTime() - 4 * DAY).toISOString();
        ansC.updated_at = new Date(now.getTime() - 3 * DAY).toISOString();
        await repository.save(new Ans(ansC));

        const ansD = AnsMother.dto();
        ansD.created_at = new Date(now.getTime() - 2 * DAY).toISOString();
        ansD.updated_at = new Date(now.getTime() - 2 * DAY).toISOString();
        await repository.save(new Ans(ansD));

        const selectFields = [
            {
                function: 'date_difference',
                alias: 'difference',
                field: 'ans.created_at::: ans.updated_at',
            },
        ];

        const criteria = new Criteria(null, null, null, null, null, tableName, selectFields, null, null);

        const result = await repository.advancedSearch(criteria, tableName);
        expect(result).toHaveLength(4);
        expect(result).toEqual(
            expect.arrayContaining([
                { difference: '172800.000000' },
                { difference: '86400.000000' },
                { difference: '86400.000000' },
                { difference: '0.000000' },
            ])
        );
    });

    test('successfully creates a new record in an existing auxiliary table', async () => {
        const tableName = 'aux_proveedores';
        const overrides = {
            data: {
                nombre: 'Proveedor 1',
                rfc: 'RFC12345678',
                direccion: 'Dirección 1',
                telefono: '1234567890',
                email: 'proveedor1@example.com',
                progreso: {
                    inicio: false,
                    finalizado: false,
                    intermedio: false,
                },
                contactos: [
                    {
                        nombre: 'Jose',
                        telefono: '3117989702',
                    },
                    {
                        nombre: 'Maria',
                        telefono: '3117989702',
                    },
                ],
            },
        };
        const payload = {
            filter: [
                {
                    type: 'and',
                    field: `${tableName}.nombre`,
                    value: 'Proveedor 3',
                    operator: 'eq',
                },
                {
                    type: 'and',
                    field: `${tableName}.progreso.inicio`,
                    value: true,
                    operator: 'eq',
                },
            ],
            limit: 0,
            offset: 0,
        };

        const criteria = new Criteria(payload.filter, null, payload.limit, payload.offset, null, tableName);

        for (let i = 0; i <= 5; i++) {
            overrides.data.nombre = `Proveedor ${i}`;
            overrides.data.progreso.inicio = i % 2 === 0;
            await AuxiliaryMother.create(auxRepository, tableName, overrides);
        }

        const query = criteria.convertToKnex(auxRepository.connection(tableName).select('*'));
        const sql = query.toSQL().sql.toLowerCase();

        expect(sql).toContain("aux_proveedores.data ->> 'nombre'");
        expect(sql).toContain("aux_proveedores.data -> 'progreso' ->> 'inicio'");
    });

    test('date_calculated_substract filters records created within the last N days', async () => {
        await repository.connection.raw('TRUNCATE TABLE ans CASCADE');

        const tableName = 'ans';
        const now = new Date();
        const DAY = 24 * 60 * 60 * 1000;

        const ansA = AnsMother.dto();
        ansA.created_at = new Date(now.getTime() - 2 * DAY).toISOString();
        ansA.intermedio = 10;
        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.created_at = new Date(now.getTime() - 5 * DAY).toISOString();
        ansB.intermedio = 20;
        await repository.save(new Ans(ansB));

        const ansC = AnsMother.dto();
        ansC.created_at = new Date(now.getTime() - 10 * DAY).toISOString();
        ansC.intermedio = 30;
        await repository.save(new Ans(ansC));

        const ansD = AnsMother.dto();
        ansD.created_at = new Date(now.getTime() - 15 * DAY).toISOString();
        ansD.intermedio = 40;
        await repository.save(new Ans(ansD));

        const filters = [
            {
                field: 'created_at',
                operator: 'gte',
                value: {
                    function: 'date_calculated_substract',
                    value: '7',
                },
                type: 'AND',
            },
        ];

        const selectFields = ['ans.id', 'ans.intermedio', 'ans.created_at'];
        const order = { field: 'intermedio', direction: 'asc' };

        const criteria = new Criteria(filters, null, null, null, order, tableName, selectFields);
        const result = await repository.advancedSearch(criteria, tableName);

        expect(result).toHaveLength(2);
        expect(result.map((r) => r.intermedio)).toEqual([10, 20]);
    });

    test('date_calculated_add filters records with dates in the future within N days', async () => {
        const tableName = 'ans';
        const now = new Date();
        const DAY = 24 * 60 * 60 * 1000;

        const ansA = AnsMother.dto();
        ansA.updated_at = new Date(now.getTime() + 3 * DAY).toISOString();
        ansA.intermedio = 100;
        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.updated_at = new Date(now.getTime() + 5 * DAY).toISOString();
        ansB.intermedio = 200;
        await repository.save(new Ans(ansB));

        const ansC = AnsMother.dto();
        ansC.updated_at = new Date(now.getTime() + 10 * DAY).toISOString();
        ansC.intermedio = 300;
        await repository.save(new Ans(ansC));

        const ansD = AnsMother.dto();
        ansD.updated_at = new Date(now.getTime() - 2 * DAY).toISOString();
        ansD.intermedio = 400;
        await repository.save(new Ans(ansD));

        const filters = [
            {
                field: 'updated_at',
                operator: 'gte',
                value: {
                    function: 'date_calculated_add',
                    value: '0',
                },
                type: 'AND',
            },
            {
                field: 'updated_at',
                operator: 'lte',
                value: {
                    function: 'date_calculated_add',
                    value: '7',
                },
                type: 'AND',
            },
        ];

        const selectFields = ['ans.id', 'ans.intermedio', 'ans.updated_at'];
        const order = { field: 'intermedio', direction: 'asc' };

        const criteria = new Criteria(filters, null, null, null, order, tableName, selectFields);
        const result = await repository.advancedSearch(criteria, tableName);

        expect(result).toHaveLength(2);
        expect(result.map((r) => r.intermedio)).toEqual([100, 200]);
    });

    test('date_calculated_substract with between filters records created between N and M days ago', async () => {
        await repository.connection.raw('TRUNCATE TABLE ans CASCADE');

        const tableName = 'ans';
        const now = new Date();
        const DAY = 24 * 60 * 60 * 1000;

        const ansA = AnsMother.dto();
        ansA.created_at = new Date(now.getTime() - 3 * DAY).toISOString();
        ansA.intermedio = 1;
        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.created_at = new Date(now.getTime() - 6 * DAY).toISOString();
        ansB.intermedio = 2;
        await repository.save(new Ans(ansB));

        const ansC = AnsMother.dto();
        ansC.created_at = new Date(now.getTime() - 8 * DAY).toISOString();
        ansC.intermedio = 3;
        await repository.save(new Ans(ansC));

        const ansD = AnsMother.dto();
        ansD.created_at = new Date(now.getTime() - 15 * DAY).toISOString();
        ansD.intermedio = 4;
        await repository.save(new Ans(ansD));

        const filters = [
            {
                field: 'created_at',
                operator: 'between',
                value: {
                    function: 'date_calculated_substract',
                    value: '5, 10',
                },
                type: 'AND',
            },
        ];

        const selectFields = ['ans.id', 'ans.intermedio', 'ans.created_at'];
        const order = { field: 'intermedio', direction: 'asc' };

        const criteria = new Criteria(filters, null, null, null, order, tableName, selectFields);
        const result = await repository.advancedSearch(criteria, tableName);

        expect(result).toHaveLength(2);
        expect(result.map((r) => r.intermedio)).toEqual([2, 3]);
    });

    test('date_calculated_add with between filters records with dates between N and M days in the future', async () => {
        const tableName = 'ans';
        const now = new Date();
        const DAY = 24 * 60 * 60 * 1000;

        const ansA = AnsMother.dto();
        ansA.updated_at = new Date(now.getTime() + 2 * DAY).toISOString();
        ansA.intermedio = 11;
        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.updated_at = new Date(now.getTime() + 7 * DAY).toISOString();
        ansB.intermedio = 22;
        await repository.save(new Ans(ansB));

        const ansC = AnsMother.dto();
        ansC.updated_at = new Date(now.getTime() + 12 * DAY).toISOString();
        ansC.intermedio = 33;
        await repository.save(new Ans(ansC));

        const ansD = AnsMother.dto();
        ansD.updated_at = new Date(now.getTime() + 20 * DAY).toISOString();
        ansD.intermedio = 44;
        await repository.save(new Ans(ansD));

        const filters = [
            {
                field: 'updated_at',
                operator: 'between',
                value: {
                    function: 'date_calculated_add',
                    value: '5, 15',
                },
                type: 'AND',
            },
        ];

        const selectFields = ['ans.id', 'ans.intermedio', 'ans.updated_at'];
        const order = { field: 'intermedio', direction: 'asc' };

        const criteria = new Criteria(filters, null, null, null, order, tableName, selectFields);
        const result = await repository.advancedSearch(criteria, tableName);

        expect(result).toHaveLength(2);
        expect(result.map((r) => r.intermedio)).toEqual([22, 33]);
    });

    test('Order by auxiliary field (JSON) should generate correct query', async () => {
        const id1 = uuidv4();
        const id2 = uuidv4();

        // Insert primary entity
        await repository.connection('ans').insert([
            {
                id: id1,
                intermedio: 10,
                created_by: uuidv4(),
                status: 1,
            },
            {
                id: id2,
                intermedio: 20,
                created_by: uuidv4(),
                status: 1,
            },
        ]);

        // Insert auxiliary entity with JSON data
        // We use aux_proveedores as it is already set up in beforeEach
        // And we alias it as case_auxiliar in the relationship
        await repository.connection('aux_proveedores').insert([
            {
                id: id1,
                data: JSON.stringify({ form1: { age: 30 } }),
            },
            {
                id: id2,
                data: JSON.stringify({ form1: { age: 20 } }),
            },
        ]);

        const relationship = [
            {
                table: 'aux_proveedores as case_auxiliar',
                condition: {
                    column: 'case_auxiliar.id',
                    refColumn: 'ans.id',
                },
                type: 'join',
            },
        ];

        // The user says: "entity": "case_auxiliar", "field": "form1.age"
        // This produces "case_auxiliar.form1.age" in Criteria through OrderByCriteria.
        const order = [
            {
                entity: 'case_auxiliar',
                field: 'form1.age',
                direction: 'asc',
            },
        ];

        const criteria = new Criteria(undefined, relationship, 10, 0, order, 'ans');

        // El orden se resuelve con `case_auxiliar.data #>> '{form1,age}'`, que devuelve text:
        // la comparacion es lexicografica, y por eso las edades del fixture son de dos digitos.
        const queryFromCriteria = criteria.convertToKnex(repository.connection('ans').select('ans.*'));
        const results = await queryFromCriteria;

        expect(results).toHaveLength(2);
        expect(results[0].id).toBe(id2); // age 20
        expect(results[1].id).toBe(id1); // age 30
    });

    test('should correctly handle created_at and updated_at as column fields', async () => {
        const tableName = 'ans';

        // created_at es timestamptz y el rango del filtro ('2025-01-01') se
        // interpreta en la zona de la sesion. Con fechas a medianoche UTC el
        // limite cae del otro lado en cualquier TZ negativa, asi que se usan
        // fechas a mitad de año: dentro/fuera del rango en cualquier zona.
        const ansA = AnsMother.dto();
        ansA.created_at = '2025-06-15T12:00:00.000Z';
        ansA.updated_at = '2025-07-01T12:00:00.000Z';

        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.created_at = '2024-06-15T12:00:00.000Z';
        ansB.updated_at = '2024-07-01T12:00:00.000Z';
        await repository.save(new Ans(ansB));

        const filters = [
            {
                field: 'created_at',
                operator: 'between',
                value: '2025-01-01, 2025-12-31',
                type: 'AND',
            },
        ];

        const order = [{ field: 'updated_at', direction: 'desc' }];

        const criteria = new Criteria(filters, null, null, null, order, tableName);

        const result = await repository.search(criteria);

        expect(result).toHaveLength(1);

        const record = result[0];

        expect(record.created_at.value.startsWith('2025')).toBe(true);
        expect(record.updated_at.value.startsWith('2025')).toBe(true);
    });

    test('should not treat created_at as auxiliary or json field', async () => {
        const filters = [
            {
                field: 'created_at',
                operator: 'eq',
                value: '2025-01-01',
                type: 'AND',
            },
        ];

        const criteria = new Criteria(filters, null, null, null, null, 'ans');

        const query = criteria.convertToKnex(repository.connection('ans').select('*'));
        console.log(query.toSQL().sql);
        const sql = query.toSQL().sql.toLowerCase();

        expect(sql).not.toContain('jsonb');
        expect(sql).not.toContain('data->');
    });
    test('between on auxiliary JSON field (entity-prefixed) should generate correct SQL without duplicating entity as JSON key', async () => {
        const filters = [
            {
                field: 'case_auxiliar.creacionform',
                operator: 'between',
                type: 'AND',
                value: ['2026-05-06T00:00:00.000Z', '2026-05-15T23:59:59.999Z'],
            },
        ];

        const relationship = [
            {
                table: 'aux_proveedores as case_auxiliar',
                condition: {
                    column: 'case_auxiliar.id',
                    refColumn: 'ans.id',
                },
                type: 'left',
            },
        ];

        const criteria = new Criteria(filters, relationship, 10, 0, null, 'ans');
        const query = criteria.convertToKnex(repository.connection('ans').select('ans.*'));
        const sql = query.toSQL().sql;

        expect(sql).toContain("case_auxiliar.data ->> 'creacionform'");
        expect(sql).not.toContain("-> 'case_auxiliar'");
        expect(sql).toContain('BETWEEN');
    });

    test('between on auxiliary JSON field (entity-prefixed) returns only records within the date range', async () => {
        const idInRange1 = uuidv4();
        const idInRange2 = uuidv4();
        const idOutOfRange = uuidv4();

        await repository.connection('ans').insert([
            { id: idInRange1, intermedio: 1, created_by: uuidv4(), status: 1 },
            { id: idInRange2, intermedio: 2, created_by: uuidv4(), status: 1 },
            { id: idOutOfRange, intermedio: 3, created_by: uuidv4(), status: 1 },
        ]);

        await repository.connection('aux_proveedores').insert([
            { id: idInRange1, data: JSON.stringify({ creacionform: '2026-05-08T10:00:00.000Z' }) },
            { id: idInRange2, data: JSON.stringify({ creacionform: '2026-05-14T23:00:00.000Z' }) },
            { id: idOutOfRange, data: JSON.stringify({ creacionform: '2026-05-20T00:00:00.000Z' }) },
        ]);

        const filters = [
            {
                field: 'case_auxiliar.creacionform',
                operator: 'between',
                type: 'AND',
                value: ['2026-05-06T00:00:00.000Z', '2026-05-15T23:59:59.999Z'],
            },
        ];

        const relationship = [
            {
                table: 'aux_proveedores as case_auxiliar',
                condition: {
                    column: 'case_auxiliar.id',
                    refColumn: 'ans.id',
                },
                type: 'left',
            },
        ];

        const criteria = new Criteria(filters, relationship, 10, 0, null, 'ans');
        const query = criteria.convertToKnex(repository.connection('ans').select('ans.*'));
        const rows = await query;

        expect(rows).toHaveLength(2);
        const returnedIds = rows.map((r) => r.id).sort();
        expect(returnedIds).toEqual([idInRange1, idInRange2].sort());
    });

    describe('between on auxiliary JSON field with dirty date values', () => {
        beforeEach(async () => {
            await repository.connection.schema.dropTableIfExists('aux_proveedores');
            await repository.connection.schema.createTable('aux_proveedores', (table) => {
                table.string('id', 36).primary();
                table.jsonb('data').notNullable();
                table.timestamp('created_at');
                table.timestamp('updated_at');
                table.timestamp('deleted_at').nullable();
                table.string('created_by', 36);
                table.string('updated_by', 36);
                table.string('deleted_by', 36);
            });
        });

        const relationship = [
            {
                table: 'aux_proveedores as case_auxiliar',
                condition: {
                    column: 'case_auxiliar.id',
                    refColumn: 'ans.id',
                },
                type: 'left',
            },
        ];

        const betweenValue = '2026-04-01T12:00:00-05:00, 2026-04-01T23:59:00-05:00';

        test('between on auxiliary JSON fecha_cita returns row when value is valid and within range', async () => {
            const id = uuidv4();
            await repository.connection('ans').insert([{ id, intermedio: 1, created_by: uuidv4(), status: 1 }]);
            await repository
                .connection('aux_proveedores')
                .insert([{ id, data: JSON.stringify({ fecha_cita: '2026-04-01T15:00:00-05:00' }) }]);

            const filters = [
                {
                    field: 'case_auxiliar.fecha_cita',
                    operator: 'between',
                    type: 'AND',
                    value: betweenValue,
                },
            ];

            const criteria = new Criteria(filters, relationship, 10, 0, null, 'ans');
            const query = criteria.convertToKnex(repository.connection('ans').select('ans.*'));
            const rows = await query;

            expect(rows).toHaveLength(1);
            expect(rows[0].id).toBe(id);
        });

        test('between on auxiliary JSON fecha_cita excludes row when value is valid but out of range', async () => {
            const id = uuidv4();
            await repository.connection('ans').insert([{ id, intermedio: 1, created_by: uuidv4(), status: 1 }]);
            await repository
                .connection('aux_proveedores')
                .insert([{ id, data: JSON.stringify({ fecha_cita: '2026-04-05T15:00:00-05:00' }) }]);

            const filters = [
                {
                    field: 'case_auxiliar.fecha_cita',
                    operator: 'between',
                    type: 'AND',
                    value: betweenValue,
                },
            ];

            const criteria = new Criteria(filters, relationship, 10, 0, null, 'ans');
            const query = criteria.convertToKnex(repository.connection('ans').select('ans.*'));
            const rows = await query;

            expect(rows).toHaveLength(0);
        });

        test('between on auxiliary JSON fecha_cita does not error when value is JSON null', async () => {
            const id = uuidv4();
            await repository.connection('ans').insert([{ id, intermedio: 1, created_by: uuidv4(), status: 1 }]);
            await repository.connection('aux_proveedores').insert([{ id, data: JSON.stringify({ fecha_cita: null }) }]);

            const filters = [
                {
                    field: 'case_auxiliar.fecha_cita',
                    operator: 'between',
                    type: 'AND',
                    value: betweenValue,
                },
            ];

            const criteria = new Criteria(filters, relationship, 10, 0, null, 'ans');
            const query = criteria.convertToKnex(repository.connection('ans').select('ans.*'));
            const rows = await query;

            expect(rows).toHaveLength(0);
        });

        test('between on auxiliary JSON fecha_cita does not error when value is empty string', async () => {
            const id = uuidv4();
            await repository.connection('ans').insert([{ id, intermedio: 1, created_by: uuidv4(), status: 1 }]);
            await repository.connection('aux_proveedores').insert([{ id, data: JSON.stringify({ fecha_cita: '' }) }]);

            const filters = [
                {
                    field: 'case_auxiliar.fecha_cita',
                    operator: 'between',
                    type: 'AND',
                    value: betweenValue,
                },
            ];

            const criteria = new Criteria(filters, relationship, 10, 0, null, 'ans');
            const query = criteria.convertToKnex(repository.connection('ans').select('ans.*'));
            const rows = await query;

            expect(rows).toHaveLength(0);
        });

        test('between on auxiliary JSON fecha_cita does not error when value is arbitrary text', async () => {
            const id = uuidv4();
            await repository.connection('ans').insert([{ id, intermedio: 1, created_by: uuidv4(), status: 1 }]);
            await repository
                .connection('aux_proveedores')
                .insert([{ id, data: JSON.stringify({ fecha_cita: 'texto aleatorio' }) }]);

            const filters = [
                {
                    field: 'case_auxiliar.fecha_cita',
                    operator: 'between',
                    type: 'AND',
                    value: betweenValue,
                },
            ];

            const criteria = new Criteria(filters, relationship, 10, 0, null, 'ans');
            const query = criteria.convertToKnex(repository.connection('ans').select('ans.*'));
            const rows = await query;

            expect(rows).toHaveLength(0);
        });

        test('between on auxiliary JSON fecha_cita does not error when value is invalid date-like string', async () => {
            const id = uuidv4();
            await repository.connection('ans').insert([{ id, intermedio: 1, created_by: uuidv4(), status: 1 }]);
            await repository
                .connection('aux_proveedores')
                .insert([{ id, data: JSON.stringify({ fecha_cita: '2026-99-99' }) }]);

            const filters = [
                {
                    field: 'case_auxiliar.fecha_cita',
                    operator: 'between',
                    type: 'AND',
                    value: betweenValue,
                },
            ];

            const criteria = new Criteria(filters, relationship, 10, 0, null, 'ans');
            const query = criteria.convertToKnex(repository.connection('ans').select('ans.*'));
            const rows = await query;

            expect(rows).toHaveLength(0);
        });
    });

    describe('comparison operators on auxiliary JSON date field with dirty values', () => {
        beforeEach(async () => {
            await repository.connection.schema.dropTableIfExists('aux_proveedores');
            await repository.connection.schema.createTable('aux_proveedores', (table) => {
                table.string('id', 36).primary();
                table.jsonb('data').notNullable();
                table.timestamp('created_at');
                table.timestamp('updated_at');
                table.timestamp('deleted_at').nullable();
                table.string('created_by', 36);
                table.string('updated_by', 36);
                table.string('deleted_by', 36);
            });
        });

        const relationship = [
            {
                table: 'aux_proveedores as case_auxiliar',
                condition: {
                    column: 'case_auxiliar.id',
                    refColumn: 'ans.id',
                },
                type: 'left',
            },
        ];

        const scenarios = [
            { label: 'json null', fecha_cita: null },
            { label: 'empty string', fecha_cita: '' },
            { label: 'arbitrary text', fecha_cita: 'texto aleatorio' },
            { label: 'invalid date-like', fecha_cita: '2026-99-99' },
            { label: 'invalid iso with suffix', fecha_cita: '2026-04-15abc' },
        ];

        const operators = [
            {
                operator: 'gt',
                value: '2026-04-01T12:00:00-05:00',
                validFechaCita: '2026-04-01T15:00:00-05:00',
                outOfRangeFechaCita: '2026-03-31T10:00:00-05:00',
            },
            {
                operator: 'gte',
                value: '2026-04-01T12:00:00-05:00',
                validFechaCita: '2026-04-01T15:00:00-05:00',
                outOfRangeFechaCita: '2026-03-31T10:00:00-05:00',
            },
            {
                operator: 'lt',
                value: '2026-04-01T23:59:00-05:00',
                validFechaCita: '2026-04-01T15:00:00-05:00',
                outOfRangeFechaCita: '2026-04-05T15:00:00-05:00',
            },
            {
                operator: 'lte',
                value: '2026-04-01T23:59:00-05:00',
                validFechaCita: '2026-04-01T15:00:00-05:00',
                outOfRangeFechaCita: '2026-04-05T15:00:00-05:00',
            },
        ];

        test.each(operators)(
            '$operator returns row with valid date value',
            async ({ operator, value, validFechaCita }) => {
                const id = uuidv4();
                await repository.connection('ans').insert([{ id, intermedio: 1, created_by: uuidv4(), status: 1 }]);
                await repository
                    .connection('aux_proveedores')
                    .insert([{ id, data: JSON.stringify({ fecha_cita: validFechaCita }) }]);

                const filters = [
                    {
                        field: 'case_auxiliar.fecha_cita',
                        operator,
                        type: 'AND',
                        value,
                    },
                ];

                const criteria = new Criteria(filters, relationship, 10, 0, null, 'ans');
                const query = criteria.convertToKnex(repository.connection('ans').select('ans.*'));
                const rows = await query;

                expect(rows).toHaveLength(1);
                expect(rows[0].id).toBe(id);
            }
        );

        test.each(operators)(
            '$operator excludes valid out-of-range value',
            async ({ operator, value, outOfRangeFechaCita }) => {
                const id = uuidv4();
                await repository.connection('ans').insert([{ id, intermedio: 1, created_by: uuidv4(), status: 1 }]);
                await repository
                    .connection('aux_proveedores')
                    .insert([{ id, data: JSON.stringify({ fecha_cita: outOfRangeFechaCita }) }]);

                const filters = [
                    {
                        field: 'case_auxiliar.fecha_cita',
                        operator,
                        type: 'AND',
                        value,
                    },
                ];

                const criteria = new Criteria(filters, relationship, 10, 0, null, 'ans');
                const query = criteria.convertToKnex(repository.connection('ans').select('ans.*'));
                const rows = await query;

                expect(rows).toHaveLength(0);
            }
        );

        test.each(operators.flatMap((operatorCase) => scenarios.map((scenario) => ({ ...operatorCase, ...scenario }))))(
            '$operator does not error with $label',
            async ({ operator, value, fecha_cita }) => {
                const id = uuidv4();
                await repository.connection('ans').insert([{ id, intermedio: 1, created_by: uuidv4(), status: 1 }]);
                await repository.connection('aux_proveedores').insert([{ id, data: JSON.stringify({ fecha_cita }) }]);

                const filters = [
                    {
                        field: 'case_auxiliar.fecha_cita',
                        operator,
                        type: 'AND',
                        value,
                    },
                ];

                const criteria = new Criteria(filters, relationship, 10, 0, null, 'ans');
                const query = criteria.convertToKnex(repository.connection('ans').select('ans.*'));
                const rows = await query;

                expect(rows).toHaveLength(0);
            }
        );
    });

    describe('between on auxiliary JSON with various PostgreSQL-accepted date string shapes', () => {
        const relationship = [
            {
                table: 'aux_proveedores as case_auxiliar',
                condition: {
                    column: 'case_auxiliar.id',
                    refColumn: 'ans.id',
                },
                type: 'left',
            },
        ];

        const wideRangeBetween = '2026-01-01T00:00:00.000Z, 2026-12-31T23:59:59.999Z';

        const storedFechaCitaShapes = [
            { label: 'date only', fecha_cita: '2026-04-15' },
            { label: 'iso with Z', fecha_cita: '2026-04-15T12:00:00.000Z' },
            { label: 'iso with offset', fecha_cita: '2026-04-15T10:00:00-05:00' },
            { label: 'space between date and time', fecha_cita: '2026-04-15 12:00:00+00' },
            { label: 'iso with milliseconds', fecha_cita: '2026-04-15T12:00:00.123Z' },
            { label: 'slash dmy 15/04/2026', fecha_cita: '15/04/2026' },
            { label: 'slash mdy 04/15/2026', fecha_cita: '04/15/2026' },
            { label: 'compact yyyymmdd', fecha_cita: '20260415' },
            { label: 'english month April 15, 2026', fecha_cita: 'April 15, 2026' },
            { label: 'english day 15 April 2026', fecha_cita: '15 April 2026' },
            { label: 'abbrev month 15 Apr 2026', fecha_cita: '15 Apr 2026' },
            { label: 'unix seconds string', fecha_cita: '1776211200' },
            { label: 'unix ms string 13 digit', fecha_cita: '1776211200000' },
        ];

        test.each(storedFechaCitaShapes)(
            'between matches row when stored fecha_cita is $label',
            async ({ fecha_cita }) => {
                const id = uuidv4();
                await repository.connection('ans').insert([{ id, intermedio: 1, created_by: uuidv4(), status: 1 }]);
                await repository.connection('aux_proveedores').insert([{ id, data: JSON.stringify({ fecha_cita }) }]);

                const filters = [
                    {
                        field: 'case_auxiliar.fecha_cita',
                        operator: 'between',
                        type: 'AND',
                        value: wideRangeBetween,
                    },
                ];

                const criteria = new Criteria(filters, relationship, 10, 0, null, 'ans');
                const query = criteria.convertToKnex(repository.connection('ans').select('ans.*'));
                const rows = await query;

                expect(rows).toHaveLength(1);
                expect(rows[0].id).toBe(id);
            }
        );

        const betweenBoundShapes = [
            { label: 'zulu range', value: '2026-04-01T00:00:00.000Z, 2026-04-01T23:59:59.999Z' },
            { label: 'date-only bounds', value: '2026-04-01, 2026-04-30' },
            { label: 'offset in bounds', value: '2026-04-01T08:00:00-05:00, 2026-04-01T20:00:00-05:00' },
            { label: 'slash dmy in bounds', value: '15/03/2026, 20/04/2026' },
        ];

        test.each(betweenBoundShapes)(
            'between with $label still matches the same in-range stored value',
            async ({ value }) => {
                const id = uuidv4();
                const fecha_cita = '2026-04-01T15:00:00-05:00';
                await repository.connection('ans').insert([{ id, intermedio: 1, created_by: uuidv4(), status: 1 }]);
                await repository.connection('aux_proveedores').insert([{ id, data: JSON.stringify({ fecha_cita }) }]);

                const filters = [
                    {
                        field: 'case_auxiliar.fecha_cita',
                        operator: 'between',
                        type: 'AND',
                        value,
                    },
                ];

                const criteria = new Criteria(filters, relationship, 10, 0, null, 'ans');
                const query = criteria.convertToKnex(repository.connection('ans').select('ans.*'));
                const rows = await query;

                expect(rows).toHaveLength(1);
                expect(rows[0].id).toBe(id);
            }
        );
    });

    describe('comparison operators on auxiliary JSON numeric fields keep numeric behavior', () => {
        const relationship = [
            {
                table: 'aux_proveedores as case_auxiliar',
                condition: {
                    column: 'case_auxiliar.id',
                    refColumn: 'ans.id',
                },
                type: 'left',
            },
        ];

        const seedNumericRows = async () => {
            const rows = [
                { id: uuidv4(), score: 5 },
                { id: uuidv4(), score: 10 },
                { id: uuidv4(), score: 15 },
            ];

            for (const row of rows) {
                await repository
                    .connection('ans')
                    .insert([{ id: row.id, intermedio: 1, created_by: uuidv4(), status: 1 }]);
                await repository
                    .connection('aux_proveedores')
                    .insert([{ id: row.id, data: JSON.stringify({ score: row.score }) }]);
            }

            return rows;
        };

        test('gt on numeric JSON field returns values above threshold', async () => {
            const seeded = await seedNumericRows();
            const expectedIds = seeded
                .filter((row) => row.score > 9)
                .map((row) => row.id)
                .sort();

            const filters = [
                {
                    field: 'case_auxiliar.score',
                    operator: 'gt',
                    type: 'AND',
                    value: 9,
                },
            ];

            const criteria = new Criteria(filters, relationship, 10, 0, null, 'ans');
            const rows = await criteria.convertToKnex(repository.connection('ans').select('ans.*'));
            const actualIds = rows.map((row) => row.id).sort();

            expect(actualIds).toEqual(expectedIds);
        });

        test('gte on numeric JSON field keeps numeric comparison', async () => {
            const seeded = await seedNumericRows();
            const expectedIds = seeded
                .filter((row) => row.score >= 10)
                .map((row) => row.id)
                .sort();

            const filters = [
                {
                    field: 'case_auxiliar.score',
                    operator: 'gte',
                    type: 'AND',
                    value: 10,
                },
            ];

            const criteria = new Criteria(filters, relationship, 10, 0, null, 'ans');
            const rows = await criteria.convertToKnex(repository.connection('ans').select('ans.*'));
            const actualIds = rows.map((row) => row.id).sort();

            expect(actualIds).toEqual(expectedIds);
        });

        test('lt on numeric JSON field keeps numeric comparison', async () => {
            const seeded = await seedNumericRows();
            const expectedIds = seeded
                .filter((row) => row.score < 11)
                .map((row) => row.id)
                .sort();

            const filters = [
                {
                    field: 'case_auxiliar.score',
                    operator: 'lt',
                    type: 'AND',
                    value: 11,
                },
            ];

            const criteria = new Criteria(filters, relationship, 10, 0, null, 'ans');
            const rows = await criteria.convertToKnex(repository.connection('ans').select('ans.*'));
            const actualIds = rows.map((row) => row.id).sort();

            expect(actualIds).toEqual(expectedIds);
        });

        test('lte on numeric JSON field keeps numeric comparison', async () => {
            const seeded = await seedNumericRows();
            const expectedIds = seeded
                .filter((row) => row.score <= 10)
                .map((row) => row.id)
                .sort();

            const filters = [
                {
                    field: 'case_auxiliar.score',
                    operator: 'lte',
                    type: 'AND',
                    value: 10,
                },
            ];

            const criteria = new Criteria(filters, relationship, 10, 0, null, 'ans');
            const rows = await criteria.convertToKnex(repository.connection('ans').select('ans.*'));
            const actualIds = rows.map((row) => row.id).sort();

            expect(actualIds).toEqual(expectedIds);
        });

        test('between on numeric JSON field keeps numeric comparison', async () => {
            const seeded = await seedNumericRows();
            const expectedIds = seeded
                .filter((row) => row.score >= 6 && row.score <= 14)
                .map((row) => row.id)
                .sort();

            const filters = [
                {
                    field: 'case_auxiliar.score',
                    operator: 'between',
                    type: 'AND',
                    value: '6,14',
                },
            ];

            const criteria = new Criteria(filters, relationship, 10, 0, null, 'ans');
            const rows = await criteria.convertToKnex(repository.connection('ans').select('ans.*'));
            const actualIds = rows.map((row) => row.id).sort();

            expect(actualIds).toEqual(expectedIds);
        });
    });

    test('should keep default behavior for non date fields', async () => {
        const tableName = 'ans';

        const ansA = AnsMother.dto();
        ansA.intermedio = 5;
        await repository.save(new Ans(ansA));

        const ansB = AnsMother.dto();
        ansB.intermedio = 10;
        await repository.save(new Ans(ansB));

        const ansC = AnsMother.dto();
        ansC.intermedio = 15;
        await repository.save(new Ans(ansC));

        const filters = [
            {
                field: 'intermedio',
                operator: 'gt',
                value: 5,
                type: 'AND',
            },
        ];

        const criteria = new Criteria(filters, null, null, null, null, tableName);

        const result = await repository.search(criteria);

        expect(result).toHaveLength(2);
    });

    test('deleted_at sin prefijo en tabla aux_ excluye registros eliminados al ejecutar la query', async () => {
        const activeId = uuidv4();
        const deletedId = uuidv4();
        const now = new Date().toISOString();

        await repository.connection('aux_proveedores').insert([
            { id: activeId, data: { nombre: 'Activo' }, created_at: now, deleted_at: null, created_by: 'test' },
            { id: deletedId, data: { nombre: 'Eliminado' }, created_at: now, deleted_at: now, created_by: 'test' },
        ]);

        const criteria = new Criteria(
            [{ field: 'deleted_at', operator: 'null', value: 'null', type: 'AND' }],
            null,
            null,
            null,
            null,
            'aux_proveedores'
        );

        const rows = await criteria.convertToKnex(repository.connection('aux_proveedores').select(['id']));

        expect(rows).toHaveLength(1);
        expect(rows[0].id).toBe(activeId);
    });

    test('deleted_at sin prefijo en tabla aux_ con multiples registros activos y eliminados', async () => {
        const active1 = uuidv4();
        const active2 = uuidv4();
        const deleted1 = uuidv4();
        const deleted2 = uuidv4();
        const now = new Date().toISOString();

        await repository.connection('aux_proveedores').insert([
            { id: active1, data: { n: 1 }, created_at: now, deleted_at: null, created_by: 'test' },
            { id: active2, data: { n: 2 }, created_at: now, deleted_at: null, created_by: 'test' },
            { id: deleted1, data: { n: 3 }, created_at: now, deleted_at: now, created_by: 'test' },
            { id: deleted2, data: { n: 4 }, created_at: now, deleted_at: now, created_by: 'test' },
        ]);

        const criteria = new Criteria(
            [{ field: 'deleted_at', operator: 'null', value: 'null', type: 'AND' }],
            null,
            null,
            null,
            null,
            'aux_proveedores'
        );

        const rows = await criteria.convertToKnex(repository.connection('aux_proveedores').select(['id']));

        expect(rows).toHaveLength(2);
        const ids = rows.map((r) => r.id);
        expect(ids).toContain(active1);
        expect(ids).toContain(active2);
        expect(ids).not.toContain(deleted1);
        expect(ids).not.toContain(deleted2);
    });

    test('jsonPathEmpty retorna registros cuyo campo JSON es null o string vacío en aux_proveedores', async () => {
        const withValue = uuidv4();
        const withEmpty = uuidv4();
        const withNull = uuidv4();
        const now = new Date().toISOString();

        await repository.connection('aux_proveedores').insert([
            { id: withValue, data: JSON.stringify({ campo_opt: 'tiene valor' }), created_at: now, created_by: 'test' },
            { id: withEmpty, data: JSON.stringify({ campo_opt: '' }), created_at: now, created_by: 'test' },
            { id: withNull, data: JSON.stringify({ campo_opt: null }), created_at: now, created_by: 'test' },
        ]);

        const knownIds = [withValue, withEmpty, withNull];

        const criteria = new Criteria(
            [{ field: 'campo_opt', operator: 'jsonPathEmpty', value: 'null', type: 'AND' }],
            null,
            null,
            null,
            null,
            'aux_proveedores'
        );

        const rows = await criteria.convertToKnex(
            repository.connection('aux_proveedores').select(['id']).whereIn('id', knownIds)
        );
        const ids = rows.map((r) => r.id);

        expect(ids).not.toContain(withValue);
        expect(ids).toContain(withEmpty);
        expect(ids).toContain(withNull);
    }, 300000);

    describe('CriteriaIntegration - jsonPathEmpty con value como clave JSONB (field.column + value key)', () => {
        beforeEach(async () => {
            await repository.connection.schema.dropTableIfExists('aux_proveedores');
            await repository.connection.schema.createTable('aux_proveedores', (table) => {
                table.string('id', 36).primary();
                table.jsonb('data').notNullable();
                table.timestamp('created_at');
                table.timestamp('updated_at');
                table.timestamp('deleted_at').nullable();
                table.string('created_by', 36);
                table.string('updated_by', 36);
                table.string('deleted_by', 36);
            });
        });

        test('jsonPathEmpty con value como clave JSONB simple (->>) filtra null y vacío', async () => {
            const withValue = uuidv4();
            const withEmpty = uuidv4();
            const withNull = uuidv4();
            const now = new Date().toISOString();

            await repository.connection('aux_proveedores').insert([
                { id: withValue, data: JSON.stringify({ id_externo: 'GEN-001' }), created_at: now, created_by: 'test' },
                { id: withEmpty, data: JSON.stringify({ id_externo: '' }), created_at: now, created_by: 'test' },
                { id: withNull, data: JSON.stringify({ id_externo: null }), created_at: now, created_by: 'test' },
            ]);

            const knownIds = [withValue, withEmpty, withNull];

            const criteria = new Criteria(
                [{ field: 'aux_proveedores.data', operator: 'jsonPathEmpty', value: 'id_externo', type: 'AND' }],
                null,
                null,
                null,
                null,
                'aux_proveedores'
            );

            const rows = await criteria.convertToKnex(
                repository.connection('aux_proveedores').select(['id']).whereIn('id', knownIds)
            );
            const ids = rows.map((r) => r.id);

            expect(ids).not.toContain(withValue);
            expect(ids).toContain(withEmpty);
            expect(ids).toContain(withNull);
        }, 300000);

        test('jsonPathEmpty con value como sub-ruta JSONB (#>>) filtra null y vacío en ruta anidada', async () => {
            const withValue = uuidv4();
            const withEmpty = uuidv4();
            const withNull = uuidv4();
            const now = new Date().toISOString();

            await repository.connection('aux_proveedores').insert([
                {
                    id: withValue,
                    data: JSON.stringify({ perfil: { id_externo: 'GEN-001' } }),
                    created_at: now,
                    created_by: 'test',
                },
                {
                    id: withEmpty,
                    data: JSON.stringify({ perfil: { id_externo: '' } }),
                    created_at: now,
                    created_by: 'test',
                },
                {
                    id: withNull,
                    data: JSON.stringify({ perfil: { id_externo: null } }),
                    created_at: now,
                    created_by: 'test',
                },
            ]);

            const knownIds = [withValue, withEmpty, withNull];

            const criteria = new Criteria(
                [{ field: 'aux_proveedores.data', operator: 'jsonPathEmpty', value: 'perfil.id_externo', type: 'AND' }],
                null,
                null,
                null,
                null,
                'aux_proveedores'
            );

            const rows = await criteria.convertToKnex(
                repository.connection('aux_proveedores').select(['id']).whereIn('id', knownIds)
            );
            const ids = rows.map((r) => r.id);

            expect(ids).not.toContain(withValue);
            expect(ids).toContain(withEmpty);
            expect(ids).toContain(withNull);
        }, 300000);

        test('jsonPathEmpty con JSONB key en value combinado con otro filtro AND', async () => {
            const matchBoth = uuidv4();
            const matchField = uuidv4();
            const matchEmpty = uuidv4();
            const now = new Date().toISOString();

            await repository.connection('aux_proveedores').insert([
                {
                    id: matchBoth,
                    data: JSON.stringify({ estado: 'activo', id_externo: '' }),
                    created_at: now,
                    created_by: 'test',
                },
                {
                    id: matchField,
                    data: JSON.stringify({ estado: 'activo', id_externo: 'GEN-1' }),
                    created_at: now,
                    created_by: 'test',
                },
                {
                    id: matchEmpty,
                    data: JSON.stringify({ estado: 'inactivo', id_externo: '' }),
                    created_at: now,
                    created_by: 'test',
                },
            ]);

            const knownIds = [matchBoth, matchField, matchEmpty];

            const criteria = new Criteria(
                [
                    { field: 'estado', operator: 'eq', value: 'activo', type: 'AND' },
                    { field: 'aux_proveedores.data', operator: 'jsonPathEmpty', value: 'id_externo', type: 'AND' },
                ],
                null,
                null,
                null,
                null,
                'aux_proveedores'
            );

            const rows = await criteria.convertToKnex(
                repository.connection('aux_proveedores').select(['id']).whereIn('id', knownIds)
            );
            const ids = rows.map((r) => r.id);

            expect(ids).toContain(matchBoth);
            expect(ids).not.toContain(matchField);
            expect(ids).not.toContain(matchEmpty);
        }, 300000);
    });

    describe('CriteriaIntegration - jsonNotPathEmpty con value como clave JSONB', () => {
        beforeEach(async () => {
            await repository.connection.schema.dropTableIfExists('aux_proveedores');
            await repository.connection.schema.createTable('aux_proveedores', (table) => {
                table.string('id', 36).primary();
                table.jsonb('data').notNullable();
                table.timestamp('created_at');
                table.timestamp('updated_at');
                table.timestamp('deleted_at').nullable();
                table.string('created_by', 36);
                table.string('updated_by', 36);
                table.string('deleted_by', 36);
            });
        });

        test('jsonNotPathEmpty con value como clave JSONB simple (->>) retorna solo los que tienen valor', async () => {
            const withValue = uuidv4();
            const withEmpty = uuidv4();
            const withNull = uuidv4();
            const now = new Date().toISOString();

            await repository.connection('aux_proveedores').insert([
                { id: withValue, data: JSON.stringify({ id_externo: 'GEN-001' }), created_at: now, created_by: 'test' },
                { id: withEmpty, data: JSON.stringify({ id_externo: '' }), created_at: now, created_by: 'test' },
                { id: withNull, data: JSON.stringify({ id_externo: null }), created_at: now, created_by: 'test' },
            ]);

            const knownIds = [withValue, withEmpty, withNull];

            const criteria = new Criteria(
                [{ field: 'aux_proveedores.data', operator: 'jsonNotPathEmpty', value: 'id_externo', type: 'AND' }],
                null,
                null,
                null,
                null,
                'aux_proveedores'
            );

            const rows = await criteria.convertToKnex(
                repository.connection('aux_proveedores').select(['id']).whereIn('id', knownIds)
            );
            const ids = rows.map((r) => r.id);

            expect(ids).toContain(withValue);
            expect(ids).not.toContain(withEmpty);
            expect(ids).not.toContain(withNull);
        }, 300000);

        test('jsonNotPathEmpty con value como sub-ruta JSONB (#>>) retorna solo los que tienen valor en ruta anidada', async () => {
            const withValue = uuidv4();
            const withEmpty = uuidv4();
            const withNull = uuidv4();
            const now = new Date().toISOString();

            await repository.connection('aux_proveedores').insert([
                {
                    id: withValue,
                    data: JSON.stringify({ perfil: { id_externo: 'GEN-001' } }),
                    created_at: now,
                    created_by: 'test',
                },
                {
                    id: withEmpty,
                    data: JSON.stringify({ perfil: { id_externo: '' } }),
                    created_at: now,
                    created_by: 'test',
                },
                {
                    id: withNull,
                    data: JSON.stringify({ perfil: { id_externo: null } }),
                    created_at: now,
                    created_by: 'test',
                },
            ]);

            const knownIds = [withValue, withEmpty, withNull];

            const criteria = new Criteria(
                [
                    {
                        field: 'aux_proveedores.data',
                        operator: 'jsonNotPathEmpty',
                        value: 'perfil.id_externo',
                        type: 'AND',
                    },
                ],
                null,
                null,
                null,
                null,
                'aux_proveedores'
            );

            const rows = await criteria.convertToKnex(
                repository.connection('aux_proveedores').select(['id']).whereIn('id', knownIds)
            );
            const ids = rows.map((r) => r.id);

            expect(ids).toContain(withValue);
            expect(ids).not.toContain(withEmpty);
            expect(ids).not.toContain(withNull);
        }, 300000);

        test('SQL generado por jsonNotPathEmpty contiene IS NOT NULL AND != (dialecto PG)', () => {
            const knexPg = knexConfig;

            const criteria = new Criteria(
                [{ field: 'aux_proveedores.data', operator: 'jsonNotPathEmpty', value: 'id_externo', type: 'AND' }],
                null,
                null,
                null,
                null,
                'aux_proveedores'
            );

            const sql = criteria.convertToKnex(knexPg('aux_proveedores').select('*')).toSQL().sql;

            expect(sql).toContain('IS NOT NULL');
            expect(sql).toContain("!= ''");
            expect(sql).not.toContain('IS NULL');
        }, 300000);
    });

    describe('CriteriaIntegration - SQL generado para columnas directas en tablas aux_', () => {
        const knexPg = knexConfig;

        test('deleted_at sin prefijo en tabla aux_ genera whereNull sobre columna directa (no jsonb path)', () => {
            const criteria = new Criteria(
                [{ field: 'deleted_at', operator: 'null', value: 'null', type: 'AND' }],
                null,
                null,
                null,
                null,
                'aux_proveedores'
            );

            const sql = criteria.convertToKnex(knexPg('aux_proveedores').select('*')).toSQL().sql;

            expect(sql).toContain('"aux_proveedores"."deleted_at" is null');
            expect(sql).not.toContain("->> 'deleted_at'");
        });

        test('deleted_at con prefijo de tabla en tabla aux_ genera whereNull sobre columna directa', () => {
            const criteria = new Criteria(
                [{ field: 'aux_proveedores.deleted_at', operator: 'null', value: 'null', type: 'AND' }],
                null,
                null,
                null,
                null,
                'aux_proveedores'
            );

            const sql = criteria.convertToKnex(knexPg('aux_proveedores').select('*')).toSQL().sql;

            expect(sql).toContain('"aux_proveedores"."deleted_at" is null');
            expect(sql).not.toContain("->> 'deleted_at'");
        });

        test('campo JSON real en aux_ (no columna directa) sigue usando jsonb path', () => {
            const criteria = new Criteria(
                [{ field: 'nombre', operator: 'eq', value: 'Test', type: 'AND' }],
                null,
                null,
                null,
                null,
                'aux_proveedores'
            );

            const sql = criteria.convertToKnex(knexPg('aux_proveedores').select('*')).toSQL().sql;

            expect(sql).toContain("->> 'nombre'");
            expect(sql).not.toContain('"aux_proveedores"."nombre"');
        });

        test('jsonPathEmpty genera SQL con IS NULL OR empty string sobre path JSON en aux_ (dialecto PG)', () => {
            const criteria = new Criteria(
                [{ field: 'campo_opt', operator: 'jsonPathEmpty', value: 'null', type: 'AND' }],
                null,
                null,
                null,
                null,
                'aux_proveedores'
            );

            const sql = criteria.convertToKnex(knexPg('aux_proveedores').select('*')).toSQL().sql;

            expect(sql).toContain('IS NULL');
            expect(sql).toContain("= ''");
        }, 300000);
    });

    test('filtering an auxiliary by its owner FK returns rows instead of zero', async () => {
        const casoId = uuidv4();
        const auxId = uuidv4();
        await repository.connection('cases').insert({ id: casoId });
        await repository.connection('aux_cases').insert({
            id: auxId,
            caso_id: casoId,
            data: JSON.stringify({ nombre: 'aux ligado al caso' }),
        });

        const filters = [{ field: 'aux_cases.caso_id', operator: 'eq', value: casoId, type: 'AND' }];
        const criteria = new Criteria(filters, null, null, null, null, 'aux_cases');
        const rows = await criteria.convertToKnex(repository.connection('aux_cases').select('aux_cases.*'));

        // Antes de tratar caso_id como columna, el filtro se reescribia como
        // data ->> 'caso_id', siempre nulo, y esto devolvia cero filas en silencio.
        expect(rows.map((row) => row.id)).toEqual([auxId]);
    });
});
