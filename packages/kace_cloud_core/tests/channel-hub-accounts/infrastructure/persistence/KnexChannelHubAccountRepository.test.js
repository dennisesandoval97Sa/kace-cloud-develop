import { KnexChannelHubAccountRepository } from '../../../../src/channel-hub-accounts/infrastructure/persistence/KnexChannelHubAccountRepository.js';

const TENANT_SCHEMA = 'tenant_schema';
const QUALIFIED_TABLE = `${TENANT_SCHEMA}.channel_hub_accounts`;

function value(value) {
    return { value };
}

function createAccount() {
    const now = new Date('2026-06-04T00:00:00.000Z');

    return {
        id: value('account-id'),
        email: value('support@example.com'),
        name: value('Support'),
        country_id: value('CO'),
        operator_id: value('imap'),
        rest_flow_id: value('rest-flow-id'),
        mail_rule_list_rest_flow_id: value(null),
        mail_rule_priority_update_rest_flow_id: value(null),
        channel_hub_connection_id: value(null),
        is_active: value(true),
        created_at: value(now),
        created_by: value('user-id'),
        updated_at: value(now),
        updated_by: value('user-id'),
        deleted_at: value(now),
        deleted_by: value('user-id'),
        channel_hub_error: value(null),
    };
}

function createQueryBuilder() {
    const builder = Promise.resolve().then(() => builder.result);

    Object.assign(builder, {
        result: [],
        select() {
            return builder;
        },
        where() {
            return builder;
        },
        whereNull() {
            return builder;
        },
        whereIn() {
            return builder;
        },
        count() {
            builder.result = [{ count: 0 }];
            return builder;
        },
        insert() {
            return Promise.resolve();
        },
        update() {
            return Promise.resolve(0);
        },
        first() {
            return Promise.resolve(null);
        },
    });

    return builder;
}

function createTenantSchemaConnection() {
    const tableCalls = [];
    const connection = (tableName) => {
        tableCalls.push(tableName);
        return createQueryBuilder();
    };

    connection.client = {
        config: {
            client: 'pg',
            schema: TENANT_SCHEMA,
        },
        on() {},
    };
    connection.raw = (sql) => ({ sql });
    connection.tableCalls = tableCalls;

    return connection;
}

function createCriteria() {
    return {
        convertToKnex(queryBuilder) {
            return queryBuilder;
        },
    };
}

describe('KnexChannelHubAccountRepository', () => {
    it('uses the tenant schema-qualified channel_hub_accounts table for every query entry point', async () => {
        const operations = [
            ['save', (repository) => repository.save(createAccount())],
            ['find', (repository) => repository.find(value('account-id'))],
            ['update', (repository) => repository.update(createAccount())],
            ['delete', (repository) => repository.delete(createAccount())],
            ['search', (repository) => repository.search(createCriteria())],
            ['count', (repository) => repository.count(createCriteria())],
            ['findByEmail', (repository) => repository.findByEmail('support@example.com')],
            ['findByConnectionId', (repository) => repository.findByConnectionId('connection-id')],
            ['findAllByEmails', (repository) => repository.findAllByEmails(['support@example.com'])],
            [
                'updateConnectionId',
                (repository) =>
                    repository.updateConnectionId('account-id', 'connection-id', null, new Date(), 'user-id'),
            ],
        ];

        for (const [, operation] of operations) {
            const connection = createTenantSchemaConnection();
            const repository = new KnexChannelHubAccountRepository(connection);

            await operation(repository);

            expect(connection.tableCalls).toEqual([QUALIFIED_TABLE]);
        }
    });
});
