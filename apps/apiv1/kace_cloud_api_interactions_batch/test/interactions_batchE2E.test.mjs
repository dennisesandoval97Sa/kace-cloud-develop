import { v4 as uuidv4 } from 'uuid';
import { KnexInteractionRepository } from '@kace/core/src/interactions/infrastructure/persistence/KnexInteractionRepository';
import { KnexWorkspacesRepository } from '@kace/core/src/workspaces/infrastructure/persistence/KnexWorkspacesRepository.js';
import WorkspaceMother from '@kace/core/tests/workspaces/domain/WorkspaceMother.js';
import { INTERACTION_EMAIL_ALREADY_LINKED } from '@kace/error-codes';
import { TestHelper } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';
import { MAX_BATCH_SIZE } from '../src/schemas.mjs';

const tenant = await TestHelper.getTenant();

describe('InteractionsBatchController test', () => {
    // Same connection resolution as the single-create E2E: the tenant knows which schema the
    // local API is talking to, unlike the raw production knexfile.
    const repository = new KnexInteractionRepository(tenant.buildKnexConfig());
    const workspaceRepository = new KnexWorkspacesRepository(repository.connection);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/interactions-batch`
            : `http://127.0.0.1:60068`;

    /** @type {Workspaces} */
    let workspace;
    /** Ids created through the API, removed in afterAll so no run leaves ghost rows behind. */
    const createdInteractionIds = [];

    const buildItem = (overrides = {}) => ({
        channel_id: 'email',
        client_identifier: uuidv4(),
        external_identifier: `ext-${uuidv4().substring(0, 8)}`,
        description: 'batch interaction',
        priority: 'normal',
        workspace_id: workspace.id.value,
        conversation_id: uuidv4(),
        ...overrides,
    });

    async function insertEmail({ emailId = uuidv4(), workspaceId = workspace.id.value } = {}) {
        const now = new Date().toISOString();

        await repository.connection('emails').insert({
            id: emailId,
            s3_key: null,
            subject: 'Batch email',
            sender: 'customer@example.com',
            to: JSON.stringify([{ name: 'Support', email: 'support@example.com' }]),
            cc: JSON.stringify([]),
            bcc: JSON.stringify([]),
            priority: 'normal',
            workspace_id: workspaceId,
            message_id: uuidv4(),
            thread_id: null,
            account_id: null,
            received_at: now,
            created_at: now,
            created_by: uuidv4(),
            updated_at: null,
            updated_by: null,
            deleted_at: null,
            deleted_by: null,
        });

        return emailId;
    }

    async function postBatch(payload) {
        try {
            const response = await TestHelper.postRequest(baseUrl, payload);
            createdInteractionIds.push(...(response.data?.data?.ids ?? []));
            return response;
        } catch (error) {
            return error.response;
        }
    }

    async function findByExternalIdentifier(externalIdentifier) {
        return repository.connection('interactions').where({ external_identifier: externalIdentifier }).first();
    }

    beforeAll(async () => {
        await TestHelper.resetSchemaAndMigrate(tenant);
        workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
    });

    afterAll(async () => {
        try {
            if (createdInteractionIds.length > 0) {
                await repository.connection('history_interactions').whereIn('entity_id', createdInteractionIds).del();
                await repository.connection('interactions').whereIn('id', createdInteractionIds).del();
            }
            await repository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('should batch create several interactions and return their ids', async () => {
        const payload = [buildItem(), buildItem(), buildItem()];

        const response = await postBatch(payload);

        expect(response.status).toBe(201);
        expect(response.data.data.ids).toHaveLength(payload.length);
        expect(response.data.data.ids[0]).toEqual(expect.any(String));

        // Ids come back in request order.
        for (const [index, item] of payload.entries()) {
            const row = await findByExternalIdentifier(item.external_identifier);
            expect(row.id).toBe(response.data.data.ids[index]);
        }
    });

    it('should roll back the whole batch when one item fails', async () => {
        const emailId = await insertEmail();
        const linked = await postBatch([buildItem({ email_id: emailId })]);
        expect(linked.status).toBe(201);

        // The first item is valid; the second one reuses an email that is already linked.
        const payload = [buildItem(), buildItem({ email_id: emailId })];

        const response = await postBatch(payload);

        expect(response.status).toBe(409);
        expect(response.data.data.code).toBe(INTERACTION_EMAIL_ALREADY_LINKED);
        // Nothing from the batch survived, not even the item that would have been valid.
        for (const item of payload) {
            expect(await findByExternalIdentifier(item.external_identifier)).toBeUndefined();
        }
    });

    it('should return 400 when the batch is empty', async () => {
        expect((await postBatch([])).status).toBe(400);
    });

    it('should return 400 when any item in the batch is invalid', async () => {
        const payload = [
            buildItem(),
            buildItem({ channel_id: undefined }), // channel_id is required
        ];

        const response = await postBatch(payload);

        expect(response.status).toBe(400);
        expect(await findByExternalIdentifier(payload[0].external_identifier)).toBeUndefined();
    });

    it(`should return 400 when the batch exceeds ${MAX_BATCH_SIZE} items`, async () => {
        const payload = Array.from({ length: MAX_BATCH_SIZE + 1 }, () => buildItem());

        expect((await postBatch(payload)).status).toBe(400);
    });

    it('should forbid unknown routes', async () => {
        let response;
        try {
            response = await TestHelper.getRequest(`${baseUrl}/invalid/resource/sure`);
        } catch (error) {
            response = error.response;
        }

        // API Gateway answers unconfigured resources with 403 (Missing Authentication Token),
        // not 404.
        expect(response.status).toBe(403);
    });
});
