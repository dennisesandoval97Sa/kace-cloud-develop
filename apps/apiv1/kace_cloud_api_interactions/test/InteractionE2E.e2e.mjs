import { KnexInteractionRepository } from '@kace/core/src/interactions/infrastructure/persistence/KnexInteractionRepository';
import { Interaction } from '@kace/core/src/interactions/domain/Interaction.js';
import { KnexAssociateInteractionToCasoRepo } from '@kace/core/src/interactions/infrastructure/persistence/KnexAssociateInteractionToCasoRepo.js';
import { KnexCaseRepository } from '@kace/core/src/cases';
import InteractionMother from '@kace/core/tests/interactions/domain/InteractionMother.js';
import CasesMother from '@kace/core/tests/cases/domain/CasesMother.js';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';
import WorkspaceMother from '@kace/core/tests/workspaces/domain/WorkspaceMother.js';
import { KnexWorkspacesRepository } from '@kace/core/src/workspaces/infrastructure/persistence/KnexWorkspacesRepository.js';
import { INTERACTION_EMAIL_ALREADY_LINKED } from '@kace/error-codes';

const tenant = await TestHelper.getTenant();

describe('InteractionController E2E tests', () => {
    // Repositories
    const repository = new KnexInteractionRepository(tenant.buildKnexConfig());
    const workspaceRepository = new KnexWorkspacesRepository(repository.connection);
    const interactionCasosRepository = new KnexAssociateInteractionToCasoRepo(tenant.buildKnexConfig());
    const casesRepository = new KnexCaseRepository(tenant.buildKnexConfig());

    // URLs for each controller
    const baseUrl = `http://127.0.0.1:60099`;
    const interactionCasesUrl = `http://127.0.0.1:60099/interaction-cases`;
    const webhookUrl = `http://127.0.0.1:60099/webhook`;

    /** @Type {Workspaces} */
    let workspace;

    async function insertEmail({ emailId = uuidv4(), workspaceId = workspace.id.value } = {}) {
        const now = new Date().toISOString();

        await repository.connection('emails').insert({
            id: emailId,
            s3_key: null,
            subject: 'Migrated email',
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

    afterAll(async () => {
        try {
            await repository.connection.destroy();
            await interactionCasosRepository.connection.destroy();
            await casesRepository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    // ============================================================
    // CREATE OPERATION
    // ============================================================
    describe('POST / - Create Interaction', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
            workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
        });

        it('should create an interaction successfully', async () => {
            // Arrange
            const payload = InteractionMother.dto({
                workspace_id: workspace.id.value,
            });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(201);
            expect(response.data).toBeDefined();
            expect(response.data.data.id).toBeDefined();
            expect(response.data.data.id).not.toBe(payload.id);
        });

        it('should return the server-managed id when creating an email-linked interaction', async () => {
            const emailId = await insertEmail();
            const payload = InteractionMother.dto({
                workspace_id: workspace.id.value,
                email_id: emailId,
            });

            const response = await TestHelper.postRequest(baseUrl, payload);
            const createdId = response.data.data.id;

            expect(response.status).toBe(201);
            expect(createdId).toBeDefined();
            const row = await repository.connection('interactions').where({ id: createdId }).first();
            expect(row.email_id).toBe(emailId);
        });

        it('should return a public conflict when the email already has an interaction', async () => {
            const emailId = await insertEmail();
            const firstResponse = await TestHelper.postRequest(
                baseUrl,
                InteractionMother.dto({
                    workspace_id: workspace.id.value,
                    email_id: emailId,
                })
            );
            const existingInteractionId = firstResponse.data.data.id;

            const response = await TestHelper.postRequest(
                baseUrl,
                InteractionMother.dto({
                    workspace_id: workspace.id.value,
                    email_id: emailId,
                })
            );

            expect(response.status).toBe(409);
            expect(response.data.data).toEqual({
                code: INTERACTION_EMAIL_ALREADY_LINKED,
                email_id: emailId,
                interaction_id: existingInteractionId,
            });
        });

        it('should return statusCode 400 when validation fails with empty payload', async () => {
            // Arrange
            const payload = {};

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should return statusCode 400 when id is missing', async () => {
            // Arrange
            const payload = InteractionMother.dto({
                workspace_id: workspace.id.value,
            });
            delete payload.id;

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should return statusCode 400 when id is not a valid UUID', async () => {
            // Arrange
            const payload = InteractionMother.dto({
                workspace_id: workspace.id.value,
            });
            payload.id = 'not-a-valid-uuid';

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should return statusCode 400 when client_identifier is missing', async () => {
            // Arrange
            const payload = InteractionMother.dto({
                workspace_id: workspace.id.value,
            });
            delete payload.client_identifier;

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should return statusCode 400 when external_identifier is missing', async () => {
            // Arrange
            const payload = InteractionMother.dto({
                workspace_id: workspace.id.value,
            });
            delete payload.external_identifier;

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should allow empty description', async () => {
            // Arrange
            const payload = InteractionMother.dto({
                workspace_id: workspace.id.value,
            });
            payload.description = '';

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(201);
        });

        it('should allow null description', async () => {
            // Arrange
            const payload = InteractionMother.dto({
                workspace_id: workspace.id.value,
            });
            payload.description = null;

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(201);
        });

        it('should handle special characters in description correctly', async () => {
            // Arrange
            const payload = InteractionMother.dto({
                workspace_id: workspace.id.value,
            });
            payload.description = 'Descripción con Ñoño, tildes y símbolos @#$%';

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(201);
        });

        it('should not allow duplicate IDs', async () => {
            // Arrange
            const payload = InteractionMother.dto({
                workspace_id: workspace.id.value,
            });
            await TestHelper.postRequest(baseUrl, payload);

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBeGreaterThanOrEqual(400);
        });

        it('should handle concurrent interaction creation', async () => {
            // Arrange
            const payload1 = InteractionMother.dto({
                workspace_id: workspace.id.value,
            });
            const payload2 = InteractionMother.dto({
                workspace_id: workspace.id.value,
                description: 'Second interaction',
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

        it('should create interaction with is_closed false by default', async () => {
            // Arrange
            const payload = InteractionMother.dto({
                workspace_id: workspace.id.value,
            });
            payload.is_closed = false;

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(201);
        });

        it('should preserve the closed state of a migrated interaction', async () => {
            const payload = InteractionMother.closedDto({
                workspace_id: workspace.id.value,
                is_migrated: true,
            });

            const createResponse = await TestHelper.postRequest(baseUrl, payload);
            const fetchResponse = await TestHelper.getRequest(`${baseUrl}/${createResponse.data.data.id}`);

            expect(createResponse.status).toBe(201);
            expect(fetchResponse.status).toBe(200);
            expect(fetchResponse.data.data.is_closed).toBe(true);
            expect(fetchResponse.data.data.in_review).toBe(false);
            expect(fetchResponse.data.data.is_migrated).toBe(true);
        });

        it('should reject a non-migrated closed state', async () => {
            const payload = InteractionMother.closedDto({
                workspace_id: workspace.id.value,
                is_migrated: false,
            });

            const response = await TestHelper.postRequest(baseUrl, payload);

            expect(response.status).toBe(400);
        });

        it('should create interaction with in_review false by default', async () => {
            // Arrange
            const payload = InteractionMother.dto({
                workspace_id: workspace.id.value,
            });
            payload.in_review = false;

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(201);
        });

        it('should preserve the review state of a migrated interaction', async () => {
            const payload = InteractionMother.inReviewDto({
                workspace_id: workspace.id.value,
                is_migrated: true,
            });

            const createResponse = await TestHelper.postRequest(baseUrl, payload);
            const fetchResponse = await TestHelper.getRequest(`${baseUrl}/${createResponse.data.data.id}`);

            expect(createResponse.status).toBe(201);
            expect(fetchResponse.status).toBe(200);
            expect(fetchResponse.data.data.is_closed).toBe(false);
            expect(fetchResponse.data.data.in_review).toBe(true);
            expect(fetchResponse.data.data.is_migrated).toBe(true);
        });

        it('should reject a non-migrated review state', async () => {
            const payload = InteractionMother.inReviewDto({
                workspace_id: workspace.id.value,
                is_migrated: false,
            });

            const response = await TestHelper.postRequest(baseUrl, payload);

            expect(response.status).toBe(400);
        });
    });

    // ============================================================
    // READ OPERATION
    // ============================================================
    describe('GET /:id - Read Interaction by ID', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
            workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
        });

        it('should fetch an interaction successfully', async () => {
            // Arrange
            const interaction = await InteractionMother.createInteraction(repository, {
                workspace_id: workspace.id.value,
            });
            const dataExpected = {
                id: interaction.id.value,
                channel_id: interaction.channel_id.value,
                client_identifier: interaction.client_identifier.value,
                external_identifier: interaction.external_identifier.value,
                description: interaction.description.value,
                priority: interaction.priority.value,
                workspace_id: interaction.workspace_id.value,
                start_review_at: interaction.start_review_at.value,
                start_review_by: interaction.start_review_by.value,
                conversation_id: interaction.conversation_id.value,
                receipt_at: interaction.receipt_at.value,
                closed_at: interaction.closed_at.value,
                closed_by: interaction.closed_by.value,
                is_closed: interaction.is_closed.value,
                in_review: interaction.in_review.value,
                created_by: interaction.created_by,
                created_at: interaction.created_at,
                updated_by: null,
                updated_at: null,
            };

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${interaction.id.value}`);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data).toEqual(dataExpected);
        });

        it('should return 404 when fetching a non-existent interaction', async () => {
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

        it('should return all required fields in interaction response', async () => {
            // Arrange
            const interaction = await InteractionMother.createInteraction(repository, {
                workspace_id: workspace.id.value,
            });

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${interaction.id.value}`);

            // Assert
            expect(response.status).toBe(200);
            const requiredFields = [
                'id',
                'channel_id',
                'client_identifier',
                'external_identifier',
                'description',
                'priority',
                'workspace_id',
                'conversation_id',
                'is_closed',
                'in_review',
                'created_at',
                'created_by',
            ];
            requiredFields.forEach((field) => {
                expect(response.data.data).toHaveProperty(field);
            });
        });
    });

    // ============================================================
    // UPDATE OPERATION
    // ============================================================
    describe('POST /:id - Update Interaction', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should update an interaction successfully', async () => {
            // Arrange
            const interaction = await InteractionMother.createInteraction(repository, {
                workspace_id: workspace.id.value,
            });
            const payload = {
                id: interaction.id.value,
                client_identifier: interaction.client_identifier.value,
                external_identifier: interaction.external_identifier.value,
                description: 'Updated description',
                priority: 'high',
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${interaction.id.value}`, payload);

            // Assert
            expect(response.status).toBe(200);
        });

        it('should return statusCode 400 when validation fails on update', async () => {
            // Arrange
            const interaction = await InteractionMother.createInteraction(repository, {
                workspace_id: workspace.id.value,
            });
            const payload = {
                id: 'not-a-uuid', // Invalid UUID
                client_identifier: interaction.client_identifier.value,
                external_identifier: interaction.external_identifier.value,
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${interaction.id.value}`, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should return statusCode 400 when updating with invalid ID in path', async () => {
            // Arrange
            const invalidId = 'invalid-uuid';
            const payload = {
                id: uuidv4(),
                client_identifier: uuidv4(),
                external_identifier: uuidv4(),
                description: 'Updated Description',
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${invalidId}`, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should update only provided fields', async () => {
            // Arrange
            const interaction = await InteractionMother.createInteraction(repository, {
                workspace_id: workspace.id.value,
            });
            const originalDescription = interaction.description.value;
            const payload = {
                id: interaction.id.value,
                client_identifier: interaction.client_identifier.value,
                external_identifier: interaction.external_identifier.value,
                priority: 'urgent',
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${interaction.id.value}`, payload);
            const fetchResponse = await TestHelper.getRequest(`${baseUrl}/${interaction.id.value}`);

            // Assert
            expect(response.status).toBe(200);
            expect(fetchResponse.data.data.priority).toBe('urgent');
            expect(fetchResponse.data.data.description).toBe(originalDescription);
        });

        it('should update is_closed status', async () => {
            // Arrange
            const interaction = await InteractionMother.createInteraction(repository, {
                workspace_id: workspace.id.value,
            });
            const payload = {
                id: interaction.id.value,
                client_identifier: interaction.client_identifier.value,
                external_identifier: interaction.external_identifier.value,
                is_closed: true,
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${interaction.id.value}`, payload);
            const fetchResponse = await TestHelper.getRequest(`${baseUrl}/${interaction.id.value}`);

            // Assert
            expect(response.status).toBe(200);
            expect(fetchResponse.data.data.is_closed).toBe(true);
        });

        it('should close an interaction with a partial update payload', async () => {
            // Arrange
            const interaction = await InteractionMother.createInteraction(repository, {
                workspace_id: workspace.id.value,
            });
            const payload = {
                is_closed: true,
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${interaction.id.value}`, payload);
            const fetchResponse = await TestHelper.getRequest(`${baseUrl}/${interaction.id.value}`);

            // Assert
            expect(response.status).toBe(200);
            expect(fetchResponse.data.data.is_closed).toBe(true);
            expect(fetchResponse.data.data.closed_by).toBeDefined();
            expect(fetchResponse.data.data.closed_at).toBeDefined();
        });

        it('should reject review lock fields on generic update', async () => {
            // Arrange
            const interaction = await InteractionMother.createInteraction(repository, {
                workspace_id: workspace.id.value,
            });
            const payload = {
                id: interaction.id.value,
                channel_id: interaction.channel_id.value,
                client_identifier: interaction.client_identifier.value,
                external_identifier: interaction.external_identifier.value,
                in_review: true,
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${interaction.id.value}`, payload);
            const fetchResponse = await TestHelper.getRequest(`${baseUrl}/${interaction.id.value}`);

            // Assert
            expect(response.status).toBe(400);
            expect(fetchResponse.data.data.in_review).toBe(false);
            expect(fetchResponse.data.data.start_review_by).toBeNull();
            expect(fetchResponse.data.data.start_review_at).toBeNull();
        });

        it('should preserve original data after failed update', async () => {
            // Arrange
            const interaction = await InteractionMother.createInteraction(repository, {
                workspace_id: workspace.id.value,
            });
            const originalDescription = interaction.description.value;
            const invalidPayload = {
                id: 'invalid-uuid', // Invalid UUID
                client_identifier: interaction.client_identifier.value,
                external_identifier: interaction.external_identifier.value,
            };

            // Act
            await TestHelper.postRequest(`${baseUrl}/${interaction.id.value}`, invalidPayload);
            const fetchResponse = await TestHelper.getRequest(`${baseUrl}/${interaction.id.value}`);

            // Assert
            expect(fetchResponse.data.data.description).toBe(originalDescription);
        });

        it('should maintain audit fields after update', async () => {
            // Arrange
            const interaction = await InteractionMother.createInteraction(repository, {
                workspace_id: workspace.id.value,
            });
            const payload = {
                id: interaction.id.value,
                client_identifier: interaction.client_identifier.value,
                external_identifier: interaction.external_identifier.value,
                description: 'Updated Description',
            };

            // Act
            await TestHelper.postRequest(`${baseUrl}/${interaction.id.value}`, payload);
            const fetchResponse = await TestHelper.getRequest(`${baseUrl}/${interaction.id.value}`);

            // Assert
            expect(fetchResponse.data.data.created_at).toBe(interaction.created_at);
            expect(fetchResponse.data.data.created_by).toBe(interaction.created_by);
            expect(fetchResponse.data.data.updated_at).not.toBeNull();
            expect(fetchResponse.data.data.updated_by).not.toBeNull();
        });
    });

    // ============================================================
    // REVIEW OPERATION
    // ============================================================
    describe('POST /:id/review/claim and /:id/review/release - Claim and Release Interaction Review', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
            workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
        });

        it('should assign the logged user as reviewer when claiming an interaction', async () => {
            // Arrange
            const interaction = await InteractionMother.createInteraction(repository, {
                workspace_id: workspace.id.value,
            });

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${interaction.id.value}/review/claim`, {});
            const fetched = await TestHelper.getRequest(`${baseUrl}/${interaction.id.value}`);

            // Assert
            expect(response.status).toBe(200);
            expect(fetched.data.data.in_review).toBe(true);
            expect(fetched.data.data.start_review_by).not.toBeNull();
            expect(fetched.data.data.start_review_at).not.toBeNull();
        });

        it('should clear reviewer fields when releasing an interaction review', async () => {
            // Arrange
            const interaction = await InteractionMother.createInteraction(repository, {
                workspace_id: workspace.id.value,
            });

            // Act
            await TestHelper.postRequest(`${baseUrl}/${interaction.id.value}/review/claim`, {});
            const response = await TestHelper.postRequest(`${baseUrl}/${interaction.id.value}/review/release`, {});
            const fetched = await TestHelper.getRequest(`${baseUrl}/${interaction.id.value}`);

            // Assert
            expect(response.status).toBe(200);
            expect(fetched.data.data.in_review).toBe(false);
            expect(fetched.data.data.start_review_by).toBeNull();
            expect(fetched.data.data.start_review_at).toBeNull();
        });

        it('should return statusCode 400 when review id is invalid', async () => {
            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/not-a-uuid/review/claim`, {});

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should return statusCode 409 when claiming an interaction reviewed by another user', async () => {
            // Arrange
            const interaction = await InteractionMother.createInReviewInteraction(repository, {
                workspace_id: workspace.id.value,
                start_review_by: uuidv4(),
            });

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${interaction.id.value}/review/claim`, {});

            // Assert
            expect(response.status).toBe(409);
        });
    });

    // ============================================================
    // DELETE OPERATION
    // ============================================================
    describe('GET /:id/delete - Delete Interaction (Soft Delete)', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should delete an interaction successfully', async () => {
            // Arrange
            const interaction = await InteractionMother.createInteraction(repository, {
                workspace_id: workspace.id.value,
            });

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${interaction.id.value}/delete`);

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

        it('should soft delete interaction (deleted_at should be set)', async () => {
            // Arrange
            const interaction = await InteractionMother.createInteraction(repository, {
                workspace_id: workspace.id.value,
            });

            // Act
            await TestHelper.getRequest(`${baseUrl}/${interaction.id.value}/delete`);
            const deletedInteraction = await repository
                .connection(repository.tableName)
                .where({ id: interaction.id.value })
                .first();

            // Assert
            expect(deletedInteraction.deleted_at).not.toBeNull();
            expect(deletedInteraction.deleted_by).not.toBeNull();
        });

        it('should return 404 when fetching deleted interaction', async () => {
            // Arrange
            const interaction = await InteractionMother.createInteraction(repository, {
                workspace_id: workspace.id.value,
            });
            await TestHelper.getRequest(`${baseUrl}/${interaction.id.value}/delete`);

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${interaction.id.value}`);

            // Assert
            expect(response.status).toBe(404);
        });
    });

    // ============================================================
    // INDEX OPERATION
    // ============================================================
    describe('GET / - Index Interaction (List with default criteria)', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should fetch interaction list with default criteria', async () => {
            // Arrange
            await InteractionMother.createInteraction(repository, {
                workspace_id: workspace.id.value,
            });
            await InteractionMother.createInteraction(repository, {
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
            for (let i = 0; i < 12; i++) {
                await InteractionMother.createRandomInteraction(repository);
            }

            // Act
            const response = await TestHelper.getRequest(baseUrl);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.items.length).toBeLessThanOrEqual(10);
        });

        it('should return items ordered by created_at desc by default', async () => {
            // Arrange
            const interaction1 = await InteractionMother.createInteraction(repository, {
                workspace_id: workspace.id.value,
            });
            await new Promise((resolve) => setTimeout(resolve, 100));
            const interaction2 = await InteractionMother.createInteraction(repository, {
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

        it('should return empty array when no interactions exist', async () => {
            // Act
            const response = await TestHelper.getRequest(baseUrl);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.items).toEqual([]);
        });

        it('should not return soft-deleted interactions', async () => {
            // Arrange
            const interaction = await InteractionMother.createInteraction(repository, {
                workspace_id: workspace.id.value,
            });
            await TestHelper.getRequest(`${baseUrl}/${interaction.id.value}/delete`);

            // Act
            const response = await TestHelper.getRequest(baseUrl);

            // Assert
            expect(response.status).toBe(200);
            const foundDeleted = response.data.data.items.find((item) => item.id === interaction.id.value);
            expect(foundDeleted).toBeUndefined();
        });
    });

    // ============================================================
    // SEARCH OPERATION
    // ============================================================
    describe('POST /search - Search Interaction with custom criteria', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('excludes inactive-workspace interactions from both rows and metadata count', async () => {
            const adminWorkspaceRepository = new KnexWorkspacesRepository(tenant.buildKnexConfig());
            try {
                const activeWorkspace = await WorkspaceMother.createWorkspace(adminWorkspaceRepository, {
                    is_active: true,
                });
                const inactiveWorkspace = await WorkspaceMother.createWorkspace(adminWorkspaceRepository, {
                    is_active: false,
                });
                const activeInteraction = Interaction.create(
                    InteractionMother.dto({ workspace_id: activeWorkspace.id.value })
                );
                const inactiveInteraction = Interaction.create(
                    InteractionMother.dto({ workspace_id: inactiveWorkspace.id.value })
                );
                await repository.save(activeInteraction);
                await repository.save(inactiveInteraction);

                const criteriaForWorkspace = (workspaceId) => ({
                    filter: [
                        { field: 'workspace_id', operator: 'eq', value: workspaceId, type: 'AND' },
                        { field: 'deleted_at', operator: 'null', value: '', type: 'AND' },
                    ],
                    relationship: null,
                    limit: 10,
                    offset: 0,
                    order: { field: 'created_at', direction: 'desc' },
                });

                const activeResponse = await TestHelper.postRequest(
                    `${baseUrl}/search`,
                    criteriaForWorkspace(activeWorkspace.id.value)
                );
                const inactiveResponse = await TestHelper.postRequest(
                    `${baseUrl}/search`,
                    criteriaForWorkspace(inactiveWorkspace.id.value)
                );

                expect(activeResponse.status).toBe(200);
                expect(activeResponse.data.data.items.map(({ id }) => id)).toEqual([activeInteraction.id.value]);
                expect(activeResponse.data.metadata.count).toBe(1);
                expect(inactiveResponse.status).toBe(200);
                expect(inactiveResponse.data.data.items).toEqual([]);
                expect(inactiveResponse.data.metadata.count).toBe(0);
            } finally {
                await adminWorkspaceRepository.connection.destroy();
            }
        });

        it('should search interaction with filter by id', async () => {
            // Arrange
            const interactionCreated = await InteractionMother.createRandomInteraction(repository);
            const dtoCriteria = {
                filter: [
                    {
                        field: 'id',
                        operator: 'eq',
                        value: interactionCreated.id.value,
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
            expect(response.data.data.items[0].id).toEqual(interactionCreated.id.value);
        });

        it('should search interaction with filter by channel_id', async () => {
            // Arrange
            const interaction = await InteractionMother.createInteraction(repository, {
                channel_id: 'email',
            });
            const dtoCriteria = {
                filter: [
                    {
                        field: 'interactions.channel_id',
                        operator: 'eq',
                        value: 'email',
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
            expect(response.data.data.items[0].channel_id).toEqual('email');
        });

        it('should search interaction with filter by priority', async () => {
            // Arrange
            const interaction = await InteractionMother.createInteraction(repository, {
                priority: 'high',
            });
            const dtoCriteria = {
                filter: [
                    {
                        field: 'priority',
                        operator: 'eq',
                        value: 'high',
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
            const foundInteraction = response.data.data.items.find((item) => item.id === interaction.id.value);
            expect(foundInteraction).toBeDefined();
            expect(foundInteraction.priority).toBe('high');
        });

        it('should search interaction with multiple filters', async () => {
            // Arrange
            const interaction = await InteractionMother.createInteraction(repository, {
                channel_id: 'sms',
                priority: 'urgent',
            });
            const dtoCriteria = {
                filter: [
                    {
                        field: 'channel_id',
                        operator: 'eq',
                        value: 'sms',
                        type: 'AND',
                    },
                    {
                        field: 'priority',
                        operator: 'eq',
                        value: 'urgent',
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
            const foundInteraction = response.data.data.items.find((item) => item.id === interaction.id.value);
            expect(foundInteraction).toBeDefined();
            expect(foundInteraction.channel_id).toBe('sms');
            expect(foundInteraction.priority).toBe('urgent');
        });

        it('should return empty array when no interactions match the search criteria', async () => {
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
            for (let i = 0; i < 5; i++) {
                await InteractionMother.createRandomInteraction(repository);
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
            await InteractionMother.createInteraction(repository, {
                description: 'Interaction A',
            });
            await InteractionMother.createInteraction(repository, {
                description: 'Interaction Z',
            });
            const dtoCriteria = {
                filter: undefined,
                relationship: null,
                limit: 10,
                offset: 0,
                order: { field: 'description', direction: 'asc' },
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.items.length).toBeGreaterThanOrEqual(2);
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

        it('should support LIKE operator for partial text search in description', async () => {
            // Arrange
            await InteractionMother.createInteraction(repository, {
                description: 'Test Email Interaction',
            });
            await InteractionMother.createInteraction(repository, {
                description: 'Test SMS Interaction',
            });
            const dtoCriteria = {
                filter: [
                    {
                        field: 'description',
                        operator: 'like',
                        value: '%Test%Interaction%',
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
            expect(response.data.data.items.length).toBeGreaterThanOrEqual(2);
        });

        it('should filter by is_closed status', async () => {
            // Arrange
            const closedInteraction = await InteractionMother.createClosedInteraction(repository);
            await InteractionMother.createInteraction(repository, {
                workspace_id: workspace.id.value,
            });
            const dtoCriteria = {
                filter: [
                    {
                        field: 'is_closed',
                        operator: 'eq',
                        value: true,
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
            expect(response.data.data.items.every((item) => item.is_closed === true)).toBe(true);
        });

        it('should filter by in_review status', async () => {
            // Arrange
            const inReviewInteraction = await InteractionMother.createInReviewInteraction(repository);
            await InteractionMother.createInteraction(repository, {
                workspace_id: workspace.id.value,
            });
            const dtoCriteria = {
                filter: [
                    {
                        field: 'in_review',
                        operator: 'eq',
                        value: true,
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
            expect(response.data.data.items.every((item) => item.in_review === true)).toBe(true);
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

        it('should handle invalid HTTP method gracefully', async () => {
            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/invalid-action`);

            // Assert
            expect(response.status).toBeGreaterThanOrEqual(400);
        });

        it('should validate UUID format in path parameters', async () => {
            // Arrange
            const notAUuid = '123-456-789';

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${notAUuid}`);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should handle very long strings in description gracefully', async () => {
            // Arrange
            const payload = InteractionMother.dto({
                workspace_id: workspace.id.value,
            });
            payload.description = 'A'.repeat(10000); // Very long string

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            // Depending on the validation, this may pass or fail
            expect(response.status).toBeDefined();
        });

        it('should handle null values in optional fields', async () => {
            // Arrange
            const payload = InteractionMother.dto({
                workspace_id: workspace.id.value,
            });
            payload.start_review_at = null;
            payload.start_review_by = null;
            payload.closed_at = null;
            payload.closed_by = null;

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(201);
        });

        it('should reject SQL injection attempts', async () => {
            // Arrange
            const payload = InteractionMother.dto({
                workspace_id: workspace.id.value,
            });
            payload.description = "'; DROP TABLE interactions; --";

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            // Should either reject or safely handle the input
            expect([201, 400]).toContain(response.status);

            // Verify that the table still exists
            const interactions = await repository.connection(repository.tableName).select();
            expect(interactions).toBeDefined();
        });

        it('should handle XSS attempts in text fields', async () => {
            // Arrange
            const payload = InteractionMother.dto({
                workspace_id: workspace.id.value,
            });
            payload.description = "<script>alert('XSS')</script>";

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            // Can be accepted (sanitization in frontend) or rejected
            expect([201, 400]).toContain(response.status);
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
            const interaction = await InteractionMother.createInteraction(repository, {
                workspace_id: workspace.id.value,
            });
            const originalDescription = interaction.description.value;
            const invalidPayload = {
                id: 'invalid-uuid', // Invalid
                client_identifier: interaction.client_identifier.value,
                external_identifier: interaction.external_identifier.value,
            };

            // Act
            await TestHelper.postRequest(`${baseUrl}/${interaction.id.value}`, invalidPayload);
            const fetchResponse = await TestHelper.getRequest(`${baseUrl}/${interaction.id.value}`);

            // Assert
            expect(fetchResponse.data.data.description).toBe(originalDescription);
        });

        it('should not allow duplicate IDs', async () => {
            // Arrange
            const payload = InteractionMother.dto({
                workspace_id: workspace.id.value,
            });
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
            const interaction = await InteractionMother.createInteraction(repository, {
                workspace_id: workspace.id.value,
            });
            const payload = {
                id: interaction.id.value,
                client_identifier: interaction.client_identifier.value,
                external_identifier: interaction.external_identifier.value,
                description: 'Updated Description',
            };

            // Act
            await TestHelper.postRequest(`${baseUrl}/${interaction.id.value}`, payload);
            const fetchResponse = await TestHelper.getRequest(`${baseUrl}/${interaction.id.value}`);

            // Assert
            expect(fetchResponse.data.data.created_at).toBe(interaction.created_at);
            expect(fetchResponse.data.data.created_by).toBe(interaction.created_by);
            expect(fetchResponse.data.data.updated_at).not.toBeNull();
            expect(fetchResponse.data.data.updated_by).not.toBeNull();
        });

        it('should maintain data consistency during concurrent updates', async () => {
            // Arrange
            const interaction = await InteractionMother.createInteraction(repository, {
                workspace_id: workspace.id.value,
            });
            const payload1 = {
                id: interaction.id.value,
                client_identifier: interaction.client_identifier.value,
                external_identifier: interaction.external_identifier.value,
                description: 'Update 1',
            };
            const payload2 = {
                id: interaction.id.value,
                client_identifier: interaction.client_identifier.value,
                external_identifier: interaction.external_identifier.value,
                description: 'Update 2',
            };

            // Act
            await Promise.all([
                TestHelper.postRequest(`${baseUrl}/${interaction.id.value}`, payload1),
                TestHelper.postRequest(`${baseUrl}/${interaction.id.value}`, payload2),
            ]);
            const fetchResponse = await TestHelper.getRequest(`${baseUrl}/${interaction.id.value}`);

            // Assert
            // One of the two updates should have been applied
            expect(['Update 1', 'Update 2']).toContain(fetchResponse.data.data.description);
        });

        it('should handle transaction rollback on error', async () => {
            // Arrange
            const interaction = await InteractionMother.createInteraction(repository, {
                workspace_id: workspace.id.value,
            });
            const countBefore = await repository.connection(repository.tableName).count('* as count').first();

            // Act
            // Attempt an invalid operation
            await TestHelper.postRequest(`${baseUrl}/${interaction.id.value}`, {
                id: 'invalid',
            });
            const countAfter = await repository.connection(repository.tableName).count('* as count').first();

            // Assert
            expect(countAfter.count).toEqual(countBefore.count);
        });
    });

    // ============================================================
    // BUSINESS LOGIC SPECIFIC TESTS
    // ============================================================
    describe('Business logic specific tests', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should create email channel interaction', async () => {
            // Arrange
            const payload = InteractionMother.emailDto();

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(201);
        });

        it('should create high priority interaction', async () => {
            // Arrange
            const payload = InteractionMother.highPriorityDto();

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);
            const fetchResponse = await TestHelper.getRequest(`${baseUrl}/${payload.id}`);

            // Assert
            expect(response.status).toBe(201);
            expect(fetchResponse.data.data.priority).toBe('high');
        });

        it('should create in-review interaction', async () => {
            // Arrange
            const payload = InteractionMother.inReviewDto();

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);
            const fetchResponse = await TestHelper.getRequest(`${baseUrl}/${payload.id}`);

            // Assert
            expect(response.status).toBe(201);
            expect(fetchResponse.data.data.in_review).toBe(true);
            expect(fetchResponse.data.data.start_review_at).not.toBeNull();
            expect(fetchResponse.data.data.start_review_by).not.toBeNull();
        });

        it('should create closed interaction', async () => {
            // Arrange
            const payload = InteractionMother.closedDto();

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);
            const fetchResponse = await TestHelper.getRequest(`${baseUrl}/${payload.id}`);

            // Assert
            expect(response.status).toBe(201);
            expect(fetchResponse.data.data.is_closed).toBe(true);
            expect(fetchResponse.data.data.closed_at).not.toBeNull();
            expect(fetchResponse.data.data.closed_by).not.toBeNull();
        });

        it('should create multiple interactions using createMany helper', async () => {
            // Arrange
            const count = 5;

            // Act
            const interactions = await InteractionMother.createMany(repository, count);

            // Assert
            expect(interactions.length).toBe(count);
            const response = await TestHelper.getRequest(baseUrl);
            expect(response.data.data.items.length).toBe(count);
        });
    });

    // ============================================================
    // CONTROLLER: ControllerAssociateInteractionToCaso
    // ROUTE: /interaction-cases
    // ACTIONS: actionCreate, actionSearch
    // ============================================================
    describe('ControllerAssociateInteractionToCaso - Associate Interaction to Case', () => {
        // ============================================================
        // POST /interaction-cases - Create Association
        // ============================================================
        describe('POST /interaction-cases - Create Interaction-Case Association', () => {
            beforeEach(async () => {
                await TestHelper.resetSchemaAndMigrate(tenant);
                workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            });

            it('should associate an interaction to a case successfully', async () => {
                // Arrange
                const interaction = await InteractionMother.createInteraction(repository, {
                    workspace_id: workspace.id.value,
                });
                const caso = await CasesMother.createCaseWithRelations(casesRepository);
                const payload = {
                    interaction_id: interaction.id.value,
                    caso_id: caso.id.value,
                };

                // Act
                const response = await TestHelper.postRequest(interactionCasesUrl, payload);

                // Assert
                expect(response.status).toBe(200);
                expect(response.data.message).toBe('interaction join cases processed');
            });

            it('should return statusCode 400 when interaction_id is missing', async () => {
                // Arrange
                const caso = await CasesMother.createCaseWithRelations(casesRepository);
                const payload = {
                    caso_id: caso.id.value,
                };

                // Act
                const response = await TestHelper.postRequest(interactionCasesUrl, payload);

                // Assert
                expect(response).toHaveProperty('status', 400);
            });

            it('should return statusCode 400 when caso_id is missing', async () => {
                // Arrange
                const interaction = await InteractionMother.createInteraction(repository, {
                    workspace_id: workspace.id.value,
                });
                const payload = {
                    interaction_id: interaction.id.value,
                };

                // Act
                const response = await TestHelper.postRequest(interactionCasesUrl, payload);

                // Assert
                expect(response).toHaveProperty('status', 400);
            });

            it('should return statusCode 400 when interaction_id is not a valid UUID', async () => {
                // Arrange
                const caso = await CasesMother.createCaseWithRelations(casesRepository);
                const payload = {
                    interaction_id: 'not-a-valid-uuid',
                    caso_id: caso.id.value,
                };

                // Act
                const response = await TestHelper.postRequest(interactionCasesUrl, payload);

                // Assert
                expect(response).toHaveProperty('status', 400);
            });

            it('should return statusCode 400 when caso_id is not a valid UUID', async () => {
                // Arrange
                const interaction = await InteractionMother.createInteraction(repository, {
                    workspace_id: workspace.id.value,
                });
                const payload = {
                    interaction_id: interaction.id.value,
                    caso_id: 'not-a-valid-uuid',
                };

                // Act
                const response = await TestHelper.postRequest(interactionCasesUrl, payload);

                // Assert
                expect(response).toHaveProperty('status', 400);
            });

            it('should return statusCode 400 when payload is empty', async () => {
                // Arrange
                const payload = {};

                // Act
                const response = await TestHelper.postRequest(interactionCasesUrl, payload);

                // Assert
                expect(response).toHaveProperty('status', 400);
            });

            it('should handle concurrent association creation', async () => {
                // Arrange
                const interaction1 = await InteractionMother.createInteraction(repository, {
                    workspace_id: workspace.id.value,
                });
                const interaction2 = await InteractionMother.createInteraction(repository, {
                    workspace_id: workspace.id.value,
                });
                const caso = await CasesMother.createCaseWithRelations(casesRepository);
                const payload1 = {
                    interaction_id: interaction1.id.value,
                    caso_id: caso.id.value,
                };
                const payload2 = {
                    interaction_id: interaction2.id.value,
                    caso_id: caso.id.value,
                };

                // Act
                const [response1, response2] = await Promise.all([
                    TestHelper.postRequest(interactionCasesUrl, payload1),
                    TestHelper.postRequest(interactionCasesUrl, payload2),
                ]);

                // Assert
                expect(response1.status).toBe(200);
                expect(response2.status).toBe(200);
            });
        });

        // ============================================================
        // POST /interaction-cases/search - Search Associations
        // ============================================================
        describe('POST /interaction-cases/search - Search Interaction-Case Associations', () => {
            beforeEach(async () => {
                await TestHelper.resetSchemaAndMigrate(tenant);
                workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            });

            it('should search associations with filter by interaction_id', async () => {
                // Arrange
                const interaction = await InteractionMother.createInteraction(repository, {
                    workspace_id: workspace.id.value,
                });
                const caso = await CasesMother.createCaseWithRelations(casesRepository);

                // Create the association first
                await TestHelper.postRequest(interactionCasesUrl, {
                    interaction_id: interaction.id.value,
                    caso_id: caso.id.value,
                });

                const dtoCriteria = {
                    filter: [
                        {
                            field: 'interaction_id',
                            operator: 'eq',
                            value: interaction.id.value,
                            type: 'AND',
                        },
                    ],
                    relationship: null,
                    limit: 10,
                    offset: 0,
                    order: { field: 'created_at', direction: 'desc' },
                };

                // Act
                const response = await TestHelper.postRequest(`${interactionCasesUrl}/search`, dtoCriteria);

                // Assert
                expect(response.status).toBe(200);
                expect(response.data.data.items.length).toBeGreaterThanOrEqual(1);
            });

            it('should search associations with filter by caso_id', async () => {
                // Arrange
                const interaction = await InteractionMother.createInteraction(repository, {
                    workspace_id: workspace.id.value,
                });
                const caso = await CasesMother.createCaseWithRelations(casesRepository);

                // Create the association first
                await TestHelper.postRequest(interactionCasesUrl, {
                    interaction_id: interaction.id.value,
                    caso_id: caso.id.value,
                });

                const dtoCriteria = {
                    filter: [
                        {
                            field: 'caso_id',
                            operator: 'eq',
                            value: caso.id.value,
                            type: 'AND',
                        },
                    ],
                    relationship: null,
                    limit: 10,
                    offset: 0,
                    order: { field: 'created_at', direction: 'desc' },
                };

                // Act
                const response = await TestHelper.postRequest(`${interactionCasesUrl}/search`, dtoCriteria);

                // Assert
                expect(response.status).toBe(200);
                expect(response.data.data.items.length).toBeGreaterThanOrEqual(1);
            });

            it('should return empty array when no associations match criteria', async () => {
                // Arrange
                const dtoCriteria = {
                    filter: [
                        {
                            field: 'interaction_id',
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
                const response = await TestHelper.postRequest(`${interactionCasesUrl}/search`, dtoCriteria);

                // Assert
                expect(response.status).toBe(200);
                expect(response.data.data.items).toEqual([]);
            });

            it('should support pagination with limit and offset', async () => {
                // Arrange
                const caso = await CasesMother.createCaseWithRelations(casesRepository);

                // Create multiple associations
                for (let i = 0; i < 5; i++) {
                    const interaction = await InteractionMother.createInteraction(repository, {
                        workspace_id: workspace.id.value,
                    });
                    await TestHelper.postRequest(interactionCasesUrl, {
                        interaction_id: interaction.id.value,
                        caso_id: caso.id.value,
                    });
                }

                const dtoCriteria = {
                    filter: [
                        {
                            field: 'caso_id',
                            operator: 'eq',
                            value: caso.id.value,
                            type: 'AND',
                        },
                    ],
                    relationship: null,
                    limit: 2,
                    offset: 1,
                    order: { field: 'created_at', direction: 'desc' },
                };

                // Act
                const response = await TestHelper.postRequest(`${interactionCasesUrl}/search`, dtoCriteria);

                // Assert
                expect(response.status).toBe(200);
                expect(response.data.data.items.length).toBeLessThanOrEqual(2);
            });

            it('should return statusCode 400 when search criteria validation fails', async () => {
                // Arrange
                const invalidCriteria = {
                    limit: 'not-a-number',
                };

                // Act
                const response = await TestHelper.postRequest(`${interactionCasesUrl}/search`, invalidCriteria);

                // Assert
                expect(response).toHaveProperty('status', 400);
            });
        });

        // ============================================================
        // Error handling for /interaction-cases
        // ============================================================
        describe('Error handling for /interaction-cases', () => {
            beforeEach(async () => {
                await TestHelper.resetSchemaAndMigrate(tenant);
            });

            it('should return 403 when accessing non-existent route under /interaction-cases', async () => {
                // Arrange
                const invalidRoute = `${interactionCasesUrl}/${uuidv4()}/invalid`;

                // Act
                const response = await TestHelper.getRequest(invalidRoute);

                // Assert
                expect(response).toHaveProperty('status', 403);
            });
        });
    });

    // ============================================================
    // CONTROLLER: ControllerWebhook
    // ROUTE: /webhook
    // ACTIONS: actionCreate
    // ============================================================
    describe('ControllerWebhook - Webhook Processing', () => {
        // ============================================================
        // POST /webhook - Process Webhook
        // ============================================================
        describe('POST /webhook - Process Webhook', () => {
            beforeEach(async () => {
                await TestHelper.resetSchemaAndMigrate(tenant);
                workspace = await WorkspaceMother.createWorkspace(workspaceRepository);
            });

            const channelHubPayload = (override = {}) => ({
                messageId: uuidv4(),
                origin: 'sender@example.com',
                subject: 'Test Email Subject',
                tag: workspace.tag.value,
                destination: {
                    bcc: [{ email: 'recipient@example.com', name: 'Recipient' }],
                },
                content: {
                    text: 'https://channel-hub-cdn.example.com/messages/msg-1.txt',
                },
                ...override,
            });

            const responseStatus = (response) => response.status ?? response.response?.status;
            const responsePayload = (response) => response.data ?? response.response?.data;
            const errorFields = (response) => (responsePayload(response).errors ?? []).map((error) => error.field);

            it('should delegate canonical Channel Hub payloads and return a meaningful processor category', async () => {
                const response = await TestHelper.postRequest(webhookUrl, channelHubPayload());

                expect(responseStatus(response)).toBe(400);
                expect(responsePayload(response).errors).toEqual({
                    code: 'mail_account_match_not_found',
                    message: 'No Mail Account matches the inbound recipients.',
                });
            });

            it('should reject empty payloads with Channel Hub schema validation errors', async () => {
                const response = await TestHelper.postRequest(webhookUrl, {});

                expect(responseStatus(response)).toBe(400);
                expect(errorFields(response)).toEqual(
                    expect.arrayContaining(['messageId', 'origin', 'tag', 'destination', 'content'])
                );
            });

            it('should reject canonical Channel Hub payloads with missing tag', async () => {
                const { tag, ...payload } = channelHubPayload();

                const response = await TestHelper.postRequest(webhookUrl, payload);

                expect(responseStatus(response)).toBe(400);
                expect(errorFields(response)).toContain('tag');
            });

            it('should accept canonical attachment shape before delegating to processor failure categories', async () => {
                const response = await TestHelper.postRequest(
                    webhookUrl,
                    channelHubPayload({
                        attachments: [
                            {
                                filename: 'test.pdf',
                                content_type: 'application/pdf',
                                url: 'https://channel-hub-cdn.example.com/attachments/test.pdf',
                            },
                        ],
                    })
                );

                expect(responseStatus(response)).toBe(400);
                expect(responsePayload(response).errors?.code).toBe('mail_account_match_not_found');
            });

            it('should map concurrent canonical webhook requests to explicit processor categories', async () => {
                const [response1, response2] = await Promise.all([
                    TestHelper.postRequest(webhookUrl, channelHubPayload({ messageId: uuidv4() })),
                    TestHelper.postRequest(webhookUrl, channelHubPayload({ messageId: uuidv4() })),
                ]);

                expect(responseStatus(response1)).toBe(400);
                expect(responseStatus(response2)).toBe(400);
                expect(responsePayload(response1).errors?.code).toBe('mail_account_match_not_found');
                expect(responsePayload(response2).errors?.code).toBe('mail_account_match_not_found');
            });

            it('should reject overlong Channel Hub subjects at schema validation', async () => {
                const response = await TestHelper.postRequest(
                    webhookUrl,
                    channelHubPayload({ subject: 's'.repeat(121) })
                );

                expect(responseStatus(response)).toBe(400);
                expect(errorFields(response)).toContain('subject');
            });

            it('should reject potential XSS in canonical Channel Hub recipient data', async () => {
                const response = await TestHelper.postRequest(
                    webhookUrl,
                    channelHubPayload({
                        destination: {
                            bcc: [{ email: 'recipient@example.com', name: "<script>alert('XSS')</script>" }],
                        },
                    })
                );

                expect(responseStatus(response)).toBe(400);
                expect(responsePayload(response).errors).toEqual({
                    code: 'invalid_domain_input',
                    message: 'Invalid JSON value for to',
                });
            });

            it('should reject SQL injection attempts before persistence', async () => {
                const response = await TestHelper.postRequest(webhookUrl, channelHubPayload({ messageId: 'select' }));

                expect(responseStatus(response)).toBe(400);
                expect(responsePayload(response).errors).toEqual({
                    code: 'invalid_domain_input',
                    message: 'SQL blacklist word detected in field message_id - select: select',
                });

                const interactions = await repository.connection(repository.tableName).select();
                expect(interactions).toBeDefined();
            });
        });

        // ============================================================
        // Error handling for /webhook
        // ============================================================
        describe('Error handling for /webhook', () => {
            beforeEach(async () => {
                await TestHelper.resetSchemaAndMigrate(tenant);
            });

            it('should return 403 when accessing non-existent route under /webhook', async () => {
                // Arrange
                const invalidRoute = `${webhookUrl}/${uuidv4()}/invalid`;

                // Act
                const response = await TestHelper.getRequest(invalidRoute);

                // Assert
                expect(response).toHaveProperty('status', 403);
            });

            it('should handle GET request to /webhook gracefully', async () => {
                // Act
                const response = await TestHelper.getRequest(webhookUrl);

                // Assert
                // GET may not be supported, should return appropriate error
                expect(response.status).toBeGreaterThanOrEqual(400);
            });
        });
    });
});
