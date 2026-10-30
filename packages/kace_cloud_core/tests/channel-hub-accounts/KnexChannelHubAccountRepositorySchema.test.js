import { KnexChannelHubAccountRepository } from '../../src/channel-hub-accounts/infrastructure/persistence/KnexChannelHubAccountRepository.js';

/**
 * Conexión Knex simulada que registra con qué nombre de tabla se la invoca.
 * Permite verificar que el repositorio consulta la tabla calificada con el
 * esquema del tenant ("schema.tabla") en Postgres, sin necesidad de una DB real.
 */
const makeMockConnection = (schema) => {
    const tablesCalled = [];
    const conn = (tableName) => {
        tablesCalled.push(tableName);
        const chain = {};
        ['where', 'whereNull', 'select', 'count', 'insert', 'update'].forEach((method) => {
            chain[method] = () => chain;
        });
        chain.first = () => Promise.resolve(null);
        return chain;
    };
    conn.client = { config: { client: 'pg', schema }, on: () => {} };
    conn.tablesCalled = tablesCalled;
    return conn;
};

describe('KnexChannelHubAccountRepository — calificación de esquema (multi-tenant PG)', () => {
    it('find consulta la tabla calificada con el esquema del tenant', async () => {
        const conn = makeMockConnection('asistencia');
        const repo = new KnexChannelHubAccountRepository(conn);

        await repo.find({ value: 'some-id' });

        expect(conn.tablesCalled).toContain('asistencia.channel_hub_accounts');
        expect(conn.tablesCalled).not.toContain('channel_hub_accounts');
    });

    it('findByEmail consulta la tabla calificada con el esquema del tenant', async () => {
        const conn = makeMockConnection('asistencia');
        const repo = new KnexChannelHubAccountRepository(conn);

        await repo.findByEmail('agent@example.com');

        expect(conn.tablesCalled).toContain('asistencia.channel_hub_accounts');
        expect(conn.tablesCalled).not.toContain('channel_hub_accounts');
    });
});
