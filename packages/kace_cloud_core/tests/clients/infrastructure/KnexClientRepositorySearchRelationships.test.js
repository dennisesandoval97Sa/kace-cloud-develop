import Knex from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { KnexClientRepository } from '../../../src/clients/index.js';
import { Criteria } from '../../../src/shared/criteria/Criteria.js';

/*
 * Estos casos no tocan Postgres: interceptan el query builder para leer el SQL que arma
 * `search()` y la fila que mapea. Lo que fijan es el contrato de `relationship` en la busqueda
 * de clientes, que la ejecucion masiva usa para adjuntar `aux_clients`:
 *
 *  - las columnas de `clients` no pueden llegar pisadas por las homonimas de la tabla unida,
 *  - `deleted_by` tiene que ir cualificado o Postgres lo rechaza como ambiguo,
 *  - la fila unida tiene que viajar entera en `relations`.
 */
const AUX_RELATIONSHIP = [
    {
        table: 'aux_clients',
        condition: { column: 'aux_clients.cliente_id', refColumn: 'clients.id' },
        type: 'left',
    },
];

const clientId = uuidv4();
const auxId = uuidv4();

const clientRow = () => ({
    id: clientId,
    documento: '1111111',
    nombres: 'Carlos',
    status: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    created_by: uuidv4(),
});

/**
 * Crea un repositorio cuyo pool de lectura devuelve un builder real de knex que, al resolverse,
 * publica su SQL y entrega las filas indicadas sin abrir conexion.
 *
 * @param {object[]} rows
 * @returns {{repo: KnexClientRepository, knex: import('knex').Knex, sql: () => string}}
 */
const buildRepository = (rows) => {
    const knex = Knex({ client: 'pg', connection: {} });
    knex.client.config.schema = 'public';
    const repo = new KnexClientRepository({ client: 'pg', connection: {}, schema: 'public' });

    let capturedSql = '';
    // Sustituye el pool de lectura por uno que entrega builders reales de knex pero resuelve
    // con `rows` en vez de ir a la base.
    Object.defineProperty(repo, 'read', {
        get: () => ({
            table: (name) => {
                const queryBuilder = knex.table(name);
                queryBuilder.then = (onFulfilled) => {
                    capturedSql = queryBuilder.toString();
                    return Promise.resolve(rows).then(onFulfilled);
                };
                return queryBuilder;
            },
        }),
    });

    return { repo, knex, sql: () => capturedSql };
};

const criteriaWith = (filter, relationship) =>
    new Criteria(filter, relationship, 10, 0, { field: 'created_at', direction: 'desc' }, 'clients');

describe('KnexClientRepository.search — relationships', () => {
    it('selects only client columns and qualifies deleted_by when a relationship joins another table', async () => {
        const { repo, knex, sql } = buildRepository([
            { ...clientRow(), aux_clients: { id: auxId, cliente_id: clientId, data: { ciudad: 'Medellin' } } },
        ]);

        await repo.search(
            criteriaWith(
                [{ field: 'clients.documento', operator: 'eq', value: '1111111', type: 'AND' }],
                AUX_RELATIONSHIP
            )
        );

        expect(sql()).toContain('select "clients".*');
        expect(sql()).toContain('row_to_json("aux_clients".*) as "aux_clients"');
        expect(sql()).toContain('left join "public"."aux_clients" on "aux_clients"."cliente_id" = "clients"."id"');
        expect(sql()).toContain('"clients"."deleted_by" is null');
        expect(sql()).not.toMatch(/select \*/);

        await knex.destroy();
    });

    it('exposes the joined row under relations, keyed by table name', async () => {
        const auxRow = { id: auxId, cliente_id: clientId, data: { ciudad: 'Medellin' } };
        const { repo, knex } = buildRepository([{ ...clientRow(), aux_clients: auxRow }]);

        const [client] = await repo.search(criteriaWith([], AUX_RELATIONSHIP));

        expect(client.id.value).toBe(clientId);
        expect(client.documento.value).toBe('1111111');
        expect(client.relations.value).toEqual({ aux_clients: auxRow });

        await knex.destroy();
    });

    it('filters by the auxiliary jsonb column through the joined table', async () => {
        const { repo, knex, sql } = buildRepository([{ ...clientRow(), aux_clients: null }]);

        await repo.search(
            criteriaWith(
                [
                    {
                        field: 'aux_clients.data',
                        operator: 'jsonContains',
                        value: JSON.stringify({ ciudad: 'Medellin' }),
                        type: 'AND',
                    },
                ],
                AUX_RELATIONSHIP
            )
        );

        expect(sql()).toContain('"aux_clients"."data"::jsonb @>');

        await knex.destroy();
    });

    it('leaves relations empty and adds no join when the criteria carries no relationship', async () => {
        const { repo, knex, sql } = buildRepository([clientRow()]);

        const [client] = await repo.search(criteriaWith([], null));

        expect(client.relations.value).toEqual({});
        expect(sql()).not.toContain('row_to_json');
        expect(sql()).not.toContain('join');

        await knex.destroy();
    });

    it('deduplicates joined tables when selecting relation rows', async () => {
        const { repo, knex, sql } = buildRepository([clientRow()]);

        await repo.search(criteriaWith([], [...AUX_RELATIONSHIP, ...AUX_RELATIONSHIP]));

        const matches = sql().match(/row_to_json\("aux_clients"\.\*\) as "aux_clients"/g) || [];
        expect(matches).toHaveLength(1);

        await knex.destroy();
    });

    it('does not project joined tables that are not in the projectable relations allowlist', async () => {
        const sensitiveRelationship = [
            {
                table: 'boveda_secretos',
                condition: { column: 'boveda_secretos.created_by', refColumn: 'clients.created_by' },
                type: 'left',
            },
        ];
        const { repo, knex, sql } = buildRepository([
            { ...clientRow(), boveda_secretos: { id: uuidv4(), secret: 'super-secret' } },
        ]);

        const [client] = await repo.search(criteriaWith([], sensitiveRelationship));

        expect(sql()).not.toContain('row_to_json("boveda_secretos".*)');
        expect(sql()).toContain('left join "public"."boveda_secretos"');
        expect(client.relations.value).toEqual({});

        await knex.destroy();
    });

    it('only projects allowlisted relations when joining mixed declared and undeclared tables', async () => {
        const mixedRelationships = [
            ...AUX_RELATIONSHIP,
            {
                table: 'mailboxes_accounts',
                condition: { column: 'mailboxes_accounts.created_by', refColumn: 'clients.created_by' },
                type: 'left',
            },
        ];
        const auxRow = { id: auxId, cliente_id: clientId, data: { ciudad: 'Medellin' } };
        const { repo, knex, sql } = buildRepository([
            {
                ...clientRow(),
                aux_clients: auxRow,
                mailboxes_accounts: { client_secret: 'shh' },
            },
        ]);

        const [client] = await repo.search(criteriaWith([], mixedRelationships));

        expect(sql()).toContain('row_to_json("aux_clients".*) as "aux_clients"');
        expect(sql()).not.toContain('row_to_json("mailboxes_accounts".*)');
        expect(client.relations.value).toEqual({ aux_clients: auxRow });

        await knex.destroy();
    });

    it('qualifies deleted_by in count() to exclude soft-deleted clients', async () => {
        const { repo, knex, sql } = buildRepository([{ count: '5' }]);

        const rows = await repo.count(criteriaWith([], []));

        expect(sql()).toContain('"clients"."deleted_by" is null');
        expect(rows).toEqual([{ count: '5' }]);

        await knex.destroy();
    });
});
