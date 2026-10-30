import { KnexMailAccountRepository } from '@kace/core/src/mail-accounts';
import MailAccountMother from '@kace/core/tests/mail-accounts/domain/MailAccountMother';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';
import { Helper } from '@kace/core/src/shared/index.js';

describe('MailAccountController test', () => {
    const repository = new KnexMailAccountRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/mail-accounts`
            : `http://127.0.0.1:60033`;

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('should create a MailAccount', async () => {
        const payload = MailAccountMother.dto();
        delete payload.host;
        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
    });

    it('return statusCode 400 when validation fails to create a MailAccount', async () => {
        const payload = {};

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should fetch a MailAccount', async () => {
        const mailAccount = await MailAccountMother.createMailAccount(repository);
        const dataExpected = {
            id: mailAccount.id.value,
            description: mailAccount.description.value,
            type: mailAccount.type.value,
            host: mailAccount.host.value,
            port: mailAccount.port.value,
            protocol: mailAccount.protocol.value,
            encryption: mailAccount.encryption.value,
            username: mailAccount.username.value,
            password: mailAccount.password.value,
            from_address: mailAccount.from_address.value,
            from_name: mailAccount.from_name.value,
            tenant_id: mailAccount.tenant_id.value,
            client_id: mailAccount.client_id.value,
            client_secret: mailAccount.client_secret.value,
            code: mailAccount.code.value,
            refresh_token: mailAccount.refresh_token.value,
            mails_download_limit: mailAccount.mails_download_limit.value,
            login_endpoint: mailAccount.login_endpoint.value,
            graph_scope: mailAccount.graph_scope.value,
            start_syncing_from: mailAccount.start_syncing_from.value,
            last_synchronization: mailAccount.last_synchronization.value,
            folders: mailAccount.folders.value,
            access_token: mailAccount.access_token.value,
            email_account: mailAccount.email_account.value,
            vault: mailAccount.vault.value,
            vault_data: mailAccount.vault_data.value,
            is_active: mailAccount.is_active.value,
            created_at: mailAccount.created_at.value,
            updated_at: null,
            created_by: mailAccount.created_by.value,
            updated_by: null,
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${mailAccount.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toEqual(dataExpected);
    });

    it('should fetch all MailAccounts using search', async () => {
        const created = await MailAccountMother.createMailAccount(repository);

        const dtoCriteria = {
            filter: [
                {
                    field: 'id',
                    operator: 'eq',
                    value: created.id.value,
                    type: 'AND',
                },
            ],
            relationship: null,
            limit: 1,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        };

        const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);
        expect(response.status).toBe(200);
        expect(response.data.data.items.length).toEqual(1);
        expect(response.data.data.items[0].id).toEqual(created.id.value);
    });

    it('should delete a MailAccount', async () => {
        const mailAccount = await MailAccountMother.createMailAccount(repository);

        const response = await TestHelper.getRequest(`${baseUrl}/${mailAccount.id.value}/delete`);

        expect(response.status).toBe(200);
    });

    it('should update a MailAccount', async () => {
        const mailAccount = await MailAccountMother.createMailAccount(repository);
        const payload = {
            description: 'Updated Description',
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${mailAccount.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('should return notFound when the resource does not exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}/invalid`);
        expect(response).toHaveProperty('status', 403);
    });
});
