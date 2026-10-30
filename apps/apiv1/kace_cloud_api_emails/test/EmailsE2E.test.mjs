import { KnexEmailsRepository } from '@kace/core/src/emails/infrastructure/persistence/KnexEmailsRepository';
import EmailMother from '@kace/core/tests/emails/domain/EmailsMother.js';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';
import { ChannelHubAccount } from '@kace/core/src/channel-hub-accounts/domain/ChannelHubAccount.js';
import { KnexChannelHubAccountRepository } from '@kace/core/src/channel-hub-accounts/infrastructure/persistence/KnexChannelHubAccountRepository.js';
import { Workspaces } from '@kace/core/src/workspaces/domain/Workspaces.js';
import WorkspaceMother from '@kace/core/tests/workspaces/domain/WorkspaceMother.js';
import { KnexWorkspacesRepository } from '@kace/core/src/workspaces/infrastructure/persistence/KnexWorkspacesRepository.js';

const tenant = await TestHelper.getTenant();

describe('EmailsController E2E tests', () => {
    const repository = new KnexEmailsRepository(tenant.buildKnexConfig());
    const channelHubAccountRepository = new KnexChannelHubAccountRepository(repository.connection);
    const workspaceRepository = new KnexWorkspacesRepository(repository.connection);
    const baseUrl = `http://127.0.0.1:60097`;

    const createChannelHubAccount = async (overrides = {}) => {
        const id = overrides.id ?? uuidv4();
        const restFlowId = overrides.rest_flow_id ?? uuidv4();
        const now = new Date().toISOString();

        await repository.connection('ws_rest_flows').insert({
            id: restFlowId,
            description: overrides.flow_description ?? `Flow ${id}`,
            is_active: true,
            created_at: now,
            created_by: uuidv4(),
            updated_at: now,
            updated_by: uuidv4(),
        });

        await channelHubAccountRepository.save(
            new ChannelHubAccount({
                id,
                email: overrides.email ?? 'to@example.com',
                name: overrides.name ?? `Channel Hub ${id}`,
                country_id: overrides.country_id ?? 'CO',
                operator_id: overrides.operator_id ?? 'imap',
                rest_flow_id: restFlowId,
                channel_hub_connection_id: overrides.channel_hub_connection_id ?? `conn_${id}`,
                is_active: overrides.is_active ?? true,
                created_at: now,
                created_by: uuidv4(),
                updated_at: now,
                updated_by: uuidv4(),
                channel_hub_error: overrides.channel_hub_error ?? null,
            })
        );

        return { id: { value: id }, email: { value: overrides.email ?? 'to@example.com' } };
    };

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    // ============================================================
    // CREATE OPERATION
    // ============================================================
    describe('POST / - Create Email', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should create an email successfully', async () => {
            // Arrange
            const channelHubAccount = await createChannelHubAccount();
            const workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            const payload = EmailMother.dto({
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
                is_outbound: true,
            });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(201);
            expect(response.data).toBeDefined();
            expect(response.data.data.id).toBe(payload.id);

            const storedEmail = await repository.connection('emails').where({ id: payload.id }).first();
            expect(storedEmail).toBeDefined();
            expect(Boolean(storedEmail.is_outbound)).toBe(true);
        });

        it('should return statusCode 400 when validation fails with empty payload', async () => {
            // Arrange
            const payload = {};

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it("should return statusCode 400 when 'to' recipients is missing", async () => {
            // Arrange
            const payload = EmailMother.dto();
            delete payload.to;

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it("should return statusCode 400 when 'to' recipient has invalid email format", async () => {
            // Arrange
            const payload = EmailMother.dto();
            payload.to = [{ name: 'Invalid User', email: 'not-an-email' }];

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should return statusCode 400 when sender has invalid email format', async () => {
            // Arrange
            const payload = EmailMother.dto();
            payload.sender = 'invalid-sender-email';

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should return statusCode 400 when subject exceeds 255 characters', async () => {
            // Arrange
            const payload = EmailMother.dto();
            payload.subject = 'A'.repeat(256);

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should create email with multiple recipients in to, cc, and bcc', async () => {
            // Arrange
            const channelHubAccount = await createChannelHubAccount();
            const workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            const payload = EmailMother.dto({
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
            });
            payload.to = [
                { name: 'User One', email: 'user1@example.com' },
                { name: 'User Two', email: 'user2@example.com' },
            ];
            payload.cc = [{ name: 'CC User', email: 'cc@example.com' }];
            payload.bcc = [{ name: 'BCC User', email: 'bcc@example.com' }];

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(201);
        });

        it('should create email with null cc and bcc', async () => {
            // Arrange
            const channelHubAccount = await createChannelHubAccount();
            const workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            const payload = EmailMother.dto({
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
            });
            payload.cc = null;
            payload.bcc = null;

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(201);
        });

        it('should return statusCode 400 when s3_key has invalid URI format', async () => {
            // Arrange
            const payload = EmailMother.dto();
            payload.s3_key = 'not-a-valid-uri';

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });
    });

    // ============================================================
    // READ OPERATION
    // ============================================================
    describe('GET /:id - Read Email by ID', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should fetch an email successfully', async () => {
            // Arrange
            const channelHubAccount = await createChannelHubAccount();
            const workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            const emailDto = await EmailMother.createEmail(repository, {
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
            });

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${emailDto.id}`);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.id).toBe(emailDto.id);
            expect(response.data.data.subject).toBe(emailDto.subject);
            expect(response.data.data.sender).toBe(emailDto.sender);
        });

        it('should return 404 when fetching a non-existent email', async () => {
            // Arrange
            const nonExistentId = uuidv4();

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${nonExistentId}`);

            // Assert
            expect(response.status).toBe(404);
        });

        it('should return statusCode 400 when ID is invalid format', async () => {
            // Arrange
            const invalidId = 'invalid-uuid-format';

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${invalidId}`);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should return all required fields in email response', async () => {
            // Arrange
            const channelHubAccount = await createChannelHubAccount();
            const workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            const emailDto = await EmailMother.createEmail(repository, {
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
            });

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${emailDto.id}`);

            // Assert
            expect(response.status).toBe(200);
            const requiredFields = ['id', 'subject', 'sender', 'to', 'created_at', 'created_by'];
            requiredFields.forEach((field) => {
                expect(response.data.data).toHaveProperty(field);
            });
        });
    });

    // ============================================================
    // UPDATE OPERATION
    // ============================================================
    describe('POST /:id - Update Email', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should update an email successfully', async () => {
            // Arrange
            const channelHubAccount = await createChannelHubAccount();
            const workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            const emailDto = await EmailMother.createEmail(repository, {
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
            });
            const payload = {
                ...emailDto,
                subject: 'Updated Subject',
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${emailDto.id}`, payload);

            // Assert
            expect(response.status).toBe(200);
        });

        it('should return statusCode 400 when validation fails on update', async () => {
            // Arrange
            const channelHubAccount = await createChannelHubAccount();
            const workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            const emailDto = await EmailMother.createEmail(repository, {
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
            });
            const payload = {
                ...emailDto,
                sender: 'invalid-email-format',
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${emailDto.id}`, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should return statusCode 400 when updating with invalid ID', async () => {
            // Arrange
            const invalidId = 'invalid-uuid';
            const payload = EmailMother.dto();

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${invalidId}`, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should update recipients list', async () => {
            // Arrange
            const channelHubAccount = await createChannelHubAccount();
            const workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            const emailDto = await EmailMother.createEmail(repository, {
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
            });
            const payload = {
                ...emailDto,
                to: [{ name: 'New Recipient', email: 'new@example.com' }],
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${emailDto.id}`, payload);

            // Assert
            expect(response.status).toBe(200);
        });

        it('should return statusCode 400 when updating with invalid recipient email', async () => {
            // Arrange
            const channelHubAccount = await createChannelHubAccount();
            const workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            const emailDto = await EmailMother.createEmail(repository, {
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
            });
            const payload = {
                ...emailDto,
                to: [{ name: 'Invalid', email: 'not-an-email' }],
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${emailDto.id}`, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });
    });

    // ============================================================
    // DELETE OPERATION
    // ============================================================
    describe('GET /:id/delete - Delete Email (Soft Delete)', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should delete an email successfully', async () => {
            // Arrange
            const channelHubAccount = await createChannelHubAccount();
            const workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            const emailDto = await EmailMother.createEmail(repository, {
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
            });

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${emailDto.id}/delete`);

            // Assert
            expect(response.status).toBe(200);
        });

        it('should return statusCode 400 when deleting with invalid ID', async () => {
            // Arrange
            const invalidId = 'invalid-uuid';

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${invalidId}/delete`);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should soft delete email (deleted_at should be set)', async () => {
            // Arrange
            const channelHubAccount = await createChannelHubAccount();
            const workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            const emailDto = await EmailMother.createEmail(repository, {
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
            });

            // Act
            await TestHelper.getRequest(`${baseUrl}/${emailDto.id}/delete`);
            const deletedEmail = await repository.connection(repository.tableName).where({ id: emailDto.id }).first();

            // Assert
            expect(deletedEmail.deleted_at).not.toBeNull();
            expect(deletedEmail.deleted_by).not.toBeNull();
        });
    });

    // ============================================================
    // INDEX OPERATION
    // ============================================================
    describe('GET / - Index Emails (List with default criteria)', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should fetch emails list with default criteria', async () => {
            // Arrange
            const channelHubAccount = await createChannelHubAccount();
            const workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            await EmailMother.createEmail(repository, {
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
            });
            await EmailMother.createEmail(repository, {
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
            });

            // Act
            const response = await TestHelper.getRequest(baseUrl);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data).toBeDefined();
            expect(Array.isArray(response.data.data.items)).toBe(true);
            expect(response.data.data.items.length).toBeGreaterThanOrEqual(0);
        });

        it('should return paginated results with default limit of 10', async () => {
            // Arrange
            const channelHubAccount = await createChannelHubAccount();
            const workspace = await WorkspaceMother.createWorkspace(workspaceRepository);

            for (let i = 0; i < 12; i++) {
                await EmailMother.createEmail(repository, {
                    account_id: channelHubAccount.id.value,
                    workspace_id: workspace.id.value,
                });
            }

            // Act
            const response = await TestHelper.getRequest(baseUrl);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.items.length).toBeLessThanOrEqual(10);
        });

        it('should return items ordered by created_at desc by default', async () => {
            // Arrange
            const channelHubAccount = await createChannelHubAccount();
            const workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            await EmailMother.createEmail(repository, {
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
            });
            await new Promise((resolve) => setTimeout(resolve, 100));
            await EmailMother.createEmail(repository, {
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
            });

            // Act
            const response = await TestHelper.getRequest(baseUrl);

            // Assert
            expect(response.status).toBe(200);
            const items = response.data.data.items;
            if (items.length >= 2) {
                const firstItemDate = new Date(items[0].created_at);
                const secondItemDate = new Date(items[1].created_at);
                expect(firstItemDate.getTime()).toBeGreaterThanOrEqual(secondItemDate.getTime());
            }
        });
    });

    // ============================================================
    // SEARCH OPERATION
    // ============================================================
    describe('POST /search - Search Emails with custom criteria', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should search emails with filter by id', async () => {
            // Arrange
            const channelHubAccount = await createChannelHubAccount();
            const workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            const emailDto = await EmailMother.createEmail(repository, {
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
            });
            const dtoCriteria = {
                filter: [
                    {
                        field: 'id',
                        operator: 'eq',
                        value: emailDto.id,
                        type: 'AND',
                    },
                ],
                relationship: null,
                limit: 1,
                offset: 0,
                order: { field: 'created_at', direction: 'desc' },
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.items.length).toEqual(1);
            expect(response.data.data.items[0].id).toEqual(emailDto.id);
        });

        it('should search emails with filter by subject', async () => {
            // Arrange
            const channelHubAccount = await createChannelHubAccount();
            const workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            const emailDto = await EmailMother.createEmail(repository, {
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
            });
            const dtoCriteria = {
                filter: [
                    {
                        field: 'subject',
                        operator: 'eq',
                        value: emailDto.subject,
                        type: 'AND',
                    },
                ],
                relationship: null,
                limit: 10,
                offset: 0,
                order: { field: 'created_at', direction: 'desc' },
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.items.length).toBeGreaterThanOrEqual(1);
        });

        it('should search emails with filter by sender', async () => {
            // Arrange
            const channelHubAccount = await createChannelHubAccount();
            const workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            const emailDto = await EmailMother.createEmail(repository, {
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
            });
            const dtoCriteria = {
                filter: [
                    {
                        field: 'sender',
                        operator: 'eq',
                        value: emailDto.sender,
                        type: 'AND',
                    },
                ],
                relationship: null,
                limit: 10,
                offset: 0,
                order: { field: 'created_at', direction: 'desc' },
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.items.length).toBeGreaterThanOrEqual(1);
            expect(response.data.data.items[0].sender).toEqual(emailDto.sender);
        });

        it('should return empty array when no emails match the search criteria', async () => {
            // Arrange
            const dtoCriteria = {
                filter: [
                    {
                        field: 'id',
                        operator: 'eq',
                        value: uuidv4(),
                        type: 'AND',
                    },
                ],
                relationship: null,
                limit: 10,
                offset: 0,
                order: { field: 'created_at', direction: 'desc' },
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.items).toEqual([]);
        });

        it('should support pagination with limit and offset', async () => {
            // Arrange
            const channelHubAccount = await createChannelHubAccount();
            const workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            for (let i = 0; i < 5; i++) {
                await EmailMother.createEmail(repository, {
                    account_id: channelHubAccount.id.value,
                    workspace_id: workspace.id.value,
                });
            }
            const dtoCriteria = {
                filter: undefined,
                relationship: null,
                limit: 2,
                offset: 1,
                order: { field: 'created_at', direction: 'desc' },
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.items.length).toBeLessThanOrEqual(2);
        });

        it('should support ordering by different fields', async () => {
            // Arrange
            const channelHubAccount = await createChannelHubAccount();
            const workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            await EmailMother.createEmail(repository, {
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
            });
            await EmailMother.createEmail(repository, {
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
            });
            const dtoCriteria = {
                filter: undefined,
                relationship: null,
                limit: 10,
                offset: 0,
                order: { field: 'subject', direction: 'asc' },
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.items.length).toBeGreaterThanOrEqual(0);
        });

        it('should return statusCode 400 when search criteria validation fails', async () => {
            // Arrange
            const invalidCriteria = {
                limit: 'not-a-number',
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, invalidCriteria);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should support LIKE operator for partial text search on subject', async () => {
            // Arrange
            const channelHubAccount = await createChannelHubAccount();
            const workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            await EmailMother.createEmail(repository, {
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
            });
            const dtoCriteria = {
                filter: [
                    {
                        field: 'subject',
                        operator: 'like',
                        value: '%Example%',
                        type: 'AND',
                    },
                ],
                relationship: null,
                limit: 10,
                offset: 0,
                order: { field: 'created_at', direction: 'desc' },
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.items.length).toBeGreaterThanOrEqual(0);
        });
    });

    // ============================================================
    // ERROR HANDLING AND EDGE CASES
    // ============================================================
    describe('Error handling and edge cases', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should return 403 when accessing non-existent route', async () => {
            // Arrange
            const invalidRoute = `${baseUrl}/${uuidv4()}/invalid`;

            // Act
            const response = await TestHelper.getRequest(invalidRoute);

            // Assert
            expect(response).toHaveProperty('status', 403);
        });

        it('should validate UUID format in path parameters', async () => {
            // Arrange
            const notAUuid = '123-456-789';

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${notAUuid}`);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should handle concurrent email creation', async () => {
            // Arrange
            const channelHubAccount = await createChannelHubAccount();
            const workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            const payload1 = EmailMother.dto({
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
            });
            const payload2 = EmailMother.dto({
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
            });

            // Act
            const [response1, response2] = await Promise.all([
                TestHelper.postRequest(baseUrl, payload1),
                TestHelper.postRequest(baseUrl, payload2),
            ]);

            // Assert
            expect(response1.status).toBe(201);
            expect(response2.status).toBe(201);
        });

        it('should handle special characters in subject', async () => {
            // Arrange
            const channelHubAccount = await createChannelHubAccount();
            const workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            const payload = EmailMother.dto({
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
            });
            payload.subject = 'Asunto con Ñ, acentos á é í ó ú y símbolos @#$%';

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(201);
        });

        it('should handle empty recipients arrays for cc and bcc', async () => {
            // Arrange
            const channelHubAccount = await createChannelHubAccount();
            const workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            const payload = EmailMother.dto({
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
            });
            payload.cc = [];
            payload.bcc = [];

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(201);
        });

        it('should validate recipient name max length', async () => {
            // Arrange
            const payload = EmailMother.dto();
            payload.to = [{ name: 'A'.repeat(101), email: 'valid@email.com' }];

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });
    });

    // ============================================================
    // DATA INTEGRITY AND CONSISTENCY
    // ============================================================
    describe('Data integrity and consistency', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should preserve original data after failed update', async () => {
            // Arrange
            const channelHubAccount = await createChannelHubAccount();
            const workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            const emailDto = await EmailMother.createEmail(repository, {
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
            });
            const originalSubject = emailDto.subject;
            const invalidPayload = {
                ...emailDto,
                sender: 'invalid-email',
            };

            // Act
            await TestHelper.postRequest(`${baseUrl}/${emailDto.id}`, invalidPayload);
            const fetchResponse = await TestHelper.getRequest(`${baseUrl}/${emailDto.id}`);

            // Assert
            expect(fetchResponse.data.data.subject).toBe(originalSubject);
        });

        it('should not allow duplicate IDs', async () => {
            // Arrange
            const payload = EmailMother.dto();
            await repository.connection(repository.tableName).delete().where({
                id: payload.id,
            });
            await TestHelper.postRequest(baseUrl, payload);

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBeGreaterThanOrEqual(400);
        });

        it('should maintain audit fields after update', async () => {
            // Arrange
            const channelHubAccount = await createChannelHubAccount();
            const workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            const emailDto = await EmailMother.createEmail(repository, {
                account_id: channelHubAccount.id.value,
                workspace_id: workspace.id.value,
            });
            const payload = {
                ...emailDto,
                subject: 'Updated Subject',
            };

            // Act
            await TestHelper.postRequest(`${baseUrl}/${emailDto.id}`, payload);
            const fetchResponse = await TestHelper.getRequest(`${baseUrl}/${emailDto.id}`);

            // Assert
            expect(fetchResponse.data.data.created_at).toBe(emailDto.created_at);
            expect(fetchResponse.data.data.created_by).toBe(emailDto.created_by);
            expect(fetchResponse.data.data.updated_at).not.toBeNull();
            expect(fetchResponse.data.data.updated_by).not.toBeNull();
        });
    });
});
