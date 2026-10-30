import { Criteria } from '../../src/shared/criteria/Criteria.js';
import { ValueObjectUuid } from '../../src/shared/index.js';
import { ChannelHubAccount } from '../../src/channel-hub-accounts/domain/ChannelHubAccount.js';
import { KnexChannelHubAccountRepository } from '../../src/channel-hub-accounts/infrastructure/persistence/KnexChannelHubAccountRepository.js';
import { knexConfig } from '../knexfile.js';

const CHANNEL_HUB_FLOW_ID = '4f7f9d13-65b9-445d-a839-d8e0ece2ed03';
const LIST_FLOW_ID = '97c63872-c414-47db-8671-9d060345af26';
const PRIORITY_UPDATE_FLOW_ID = 'a67046c5-fd1a-4433-96cc-2ffa3e405809';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const BASE_DATE = '2026-06-04T00:00:00.000Z';

const repository = new KnexChannelHubAccountRepository(knexConfig);

const valueObjectId = (id) => new ValueObjectUuid('id', id);

const criteria = ({ filter, limit = 10, offset = 0, order = { field: 'created_at', direction: 'asc' } } = {}) =>
    new Criteria(filter, undefined, limit, offset, order, repository.tableName);

const accountDto = (overrides = {}) => ({
    id: '22222222-2222-4222-8222-222222222222',
    email: 'support@example.com',
    name: 'Support inbox',
    country_id: 'CO',
    operator_id: 'imap',
    rest_flow_id: CHANNEL_HUB_FLOW_ID,
    mail_rule_list_rest_flow_id: null,
    mail_rule_priority_update_rest_flow_id: null,
    channel_hub_connection_id: null,
    is_active: true,
    created_at: BASE_DATE,
    created_by: USER_ID,
    updated_at: BASE_DATE,
    updated_by: USER_ID,
    deleted_at: null,
    deleted_by: null,
    channel_hub_error: null,
    ...overrides,
});

const account = (overrides = {}) => new ChannelHubAccount(accountDto(overrides));

const saveAccounts = async (...accounts) => {
    for (const item of accounts) {
        await repository.save(item);
    }
};

describe('ChannelHubAccountsIntegration', () => {
    beforeEach(async () => {
        await repository.connection('channel_hub_accounts').delete();
    });

    it('persists and reads a Channel Hub account through the real repository', async () => {
        await repository.save(
            account({
                channel_hub_connection_id: 'connection-1',
                channel_hub_error: { statusCode: 400, detail: 'bad_request' },
                mail_rule_list_rest_flow_id: LIST_FLOW_ID,
                mail_rule_priority_update_rest_flow_id: PRIORITY_UPDATE_FLOW_ID,
            })
        );

        const found = await repository.find(valueObjectId('22222222-2222-4222-8222-222222222222'));

        expect(found).toBeInstanceOf(ChannelHubAccount);
        expect(found.toJson()).toMatchObject({
            id: '22222222-2222-4222-8222-222222222222',
            email: 'support@example.com',
            name: 'Support inbox',
            country_id: 'CO',
            operator_id: 'imap',
            rest_flow_id: CHANNEL_HUB_FLOW_ID,
            mail_rule_list_rest_flow_id: LIST_FLOW_ID,
            mail_rule_priority_update_rest_flow_id: PRIORITY_UPDATE_FLOW_ID,
            channel_hub_connection_id: 'connection-1',
            channel_hub_error: { statusCode: 400, detail: 'bad_request' },
        });
    });

    it('searches and counts only non-deleted Channel Hub accounts using real criteria', async () => {
        await saveAccounts(
            account({
                id: '33333333-3333-4333-8333-333333333333',
                email: 'active-a@example.com',
                name: 'Active A',
                created_at: '2026-06-04T00:00:00.000Z',
            }),
            account({
                id: '44444444-4444-4444-8444-444444444444',
                email: 'active-b@example.com',
                name: 'Active B',
                created_at: '2026-06-04T00:00:01.000Z',
            }),
            account({
                id: '55555555-5555-4555-8555-555555555555',
                email: 'deleted@example.com',
                name: 'Deleted',
                created_at: '2026-06-04T00:00:02.000Z',
            })
        );
        await repository.delete(
            account({
                id: '55555555-5555-4555-8555-555555555555',
                email: 'deleted@example.com',
                name: 'Deleted',
                deleted_at: '2026-06-04T00:00:03.000Z',
                deleted_by: USER_ID,
                updated_at: '2026-06-04T00:00:03.000Z',
            })
        );

        const imapFilter = [{ field: 'operator_id', operator: 'eq', value: 'imap', type: 'AND' }];
        const onlyImap = criteria({ filter: imapFilter });
        // El contador recibe el criterio sin orden ni paginacion, igual que
        // hace `ChannelHubAccountSearcher` a traves de `Counter`: un ORDER BY
        // sobre `count(*)` sin GROUP BY es un error en postgres.
        const onlyImapCount = criteria({ filter: imapFilter, limit: null, offset: null, order: null });

        const rows = await repository.search(onlyImap);
        const count = await repository.count(onlyImapCount);

        expect(rows.map((row) => row.email.value)).toEqual(['active-a@example.com', 'active-b@example.com']);
        expect(Number(count)).toBe(2);
    });

    it('updates, soft-deletes, and resolves accounts by email against the database', async () => {
        await saveAccounts(
            account({ email: 'Support@Example.com' }),
            account({
                id: '66666666-6666-4666-8666-666666666666',
                email: 'billing@example.com',
                name: 'Billing inbox',
            })
        );

        await repository.update(
            account({
                name: 'Updated support inbox',
                operator_id: 'gmail',
                channel_hub_connection_id: 'updated-connection',
                channel_hub_error: { statusCode: 409, detail: 'conflict' },
                updated_at: '2026-06-04T01:00:00.000Z',
            })
        );

        const updated = await repository.find(valueObjectId('22222222-2222-4222-8222-222222222222'));
        expect(updated.toJson()).toMatchObject({
            name: 'Updated support inbox',
            operator_id: 'gmail',
            channel_hub_connection_id: 'updated-connection',
            channel_hub_error: { statusCode: 409, detail: 'conflict' },
        });

        const matches = await repository.findAllByEmails([
            'support@example.com',
            'SUPPORT@example.com',
            'missing@example.com',
        ]);
        expect(matches).toHaveLength(1);
        expect(matches[0].id.value).toBe('22222222-2222-4222-8222-222222222222');

        await repository.delete(
            account({
                name: 'Updated support inbox',
                operator_id: 'gmail',
                channel_hub_connection_id: 'updated-connection',
                deleted_at: '2026-06-04T02:00:00.000Z',
                deleted_by: USER_ID,
                updated_at: '2026-06-04T02:00:00.000Z',
            })
        );

        expect(await repository.find(valueObjectId('22222222-2222-4222-8222-222222222222'))).toBeNull();
        expect(await repository.findAllByEmails(['support@example.com'])).toEqual([]);
    });
});
