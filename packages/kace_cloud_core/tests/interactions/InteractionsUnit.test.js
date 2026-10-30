import { v4 as uuidv4 } from 'uuid';
import { jest } from '@jest/globals';
import { DeleteFieldsDoNotExistError, ValidationFailError } from '../../src/shared/index.js';
import { Interaction } from '../../src/interactions/domain/Interaction.js';
import { InteractionCollectionResponse } from '../../src/interactions/application/InteractionCollectionResponse.js';
import { InteractionResponse } from '../../src/interactions/application/InteractionResponse.js';
import { CustomError } from '../../src/shared/index.js';
import { InteractionBulkMover } from '../../src/interactions/application/bulk-mover/InteractionBulkMover.js';
import { AgentMoveDestinationFinder } from '../../src/interactions/application/bulk-mover/AgentMoveDestinationFinder.js';
import { InteractionBulkCloser } from '../../src/interactions/application/bulk-closer/InteractionBulkCloser.js';
import { InteractionBulkDeleter } from '../../src/interactions/application/bulk-deleter/InteractionBulkDeleter.js';
import { InteractionReviewClaimer } from '../../src/interactions/application/review/InteractionReviewClaimer.js';
import { InteractionReviewReleaser } from '../../src/interactions/application/review/InteractionReviewReleaser.js';
import { InteractionUpdater } from '../../src/interactions/application/update/InteractionUpdater.js';
import { KnexInteractionRepository } from '../../src/interactions/infrastructure/persistence/KnexInteractionRepository.js';
import { SYSTEM_INBOX_WORKSPACE_ID } from '../../src/workspaces/domain/SystemInboxWorkspace.js';

describe('Interactions test', () => {
    const baseDto = () => ({
        id: uuidv4(),
        channel_id: 'email',
        client_identifier: uuidv4(),
        external_identifier: uuidv4(),
        description: 'Interaction de prueba',
        priority: 'high',
        is_closed: false,
        in_review: false,
        workspace_id: uuidv4(),
        conversation_id: uuidv4(),
        created_by: uuidv4(),
        created_at: new Date().toISOString(),
    });

    it('should return an Interaction instance', () => {
        const dto = {
            ...baseDto(),
        };

        const interaction = Interaction.create(dto);
        expect(interaction).toBeInstanceOf(Interaction);
        expect(interaction.id.value).toEqual(dto.id);
        expect(interaction.channel_id.value).toEqual(dto.channel_id);
        expect(interaction.client_identifier.value).toEqual(dto.client_identifier);
        expect(interaction.external_identifier.value).toEqual(dto.external_identifier);
        expect(interaction.description.value).toEqual(dto.description);
        expect(interaction.priority.value).toEqual(dto.priority);
        expect(interaction.is_closed.value).toEqual(dto.is_closed);
        expect(interaction.in_review.value).toEqual(dto.in_review);
        expect(interaction.workspace_id.value).toEqual(dto.workspace_id);
        expect(interaction.conversation_id.value).toEqual(dto.conversation_id);
        expect(interaction.created_at.value).toEqual(dto.created_at);
        expect(interaction.created_by.value).toEqual(dto.created_by);
    });

    it('keeps new interactions workspace-required while reconstituting legacy null workspace rows', () => {
        const legacyDto = { ...baseDto(), workspace_id: null };

        expect(() => Interaction.create(legacyDto)).toThrow('workspace_id: The value cannot be null');
        expect(Interaction.reconstitute(legacyDto).workspace_id.value).toBeNull();
    });

    it('supports close and delete observations', () => {
        const dto = {
            ...baseDto(),
            closed_observation: 'Cliente no responde',
            delete_observation: 'Duplicado',
        };

        const interaction = Interaction.create(dto);

        expect(interaction.closed_observation.value).toEqual(dto.closed_observation);
        expect(interaction.delete_observation.value).toEqual(dto.delete_observation);
    });

    it('accepts a database timestamp value for closed_at', () => {
        const closedAt = new Date('2026-05-26T18:32:09.168Z');
        const interaction = Interaction.create({
            ...baseDto(),
            closed_at: closedAt,
        });

        expect(interaction.closed_at.value).toEqual(closedAt.toISOString());
        expect(new InteractionResponse(interaction).toJson().data.closed_at).toEqual(closedAt.toISOString());
    });

    it('should update an Interaction', () => {
        const interaction = Interaction.create(baseDto());

        const updateDto = {
            description: 'Nueva descripción de interacción actualizada',
            priority: 'high',
            closed_by: uuidv4(),
            is_closed: true,
            closed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
            closed_observation: 'Cliente no responde',
        };

        interaction.update(updateDto);

        expect(interaction.description.value).toEqual(updateDto.description);
        expect(interaction.priority.value).toEqual(updateDto.priority);
        expect(interaction.is_closed.value).toEqual(updateDto.is_closed);
        expect(interaction.updated_at.value).toEqual(updateDto.updated_at);
        expect(interaction.updated_by.value).toEqual(updateDto.updated_by);
        expect(interaction.closed_observation.value).toEqual(updateDto.closed_observation);
    });

    it('does not update properties when values are the same', () => {
        const dto = baseDto();
        const interaction = Interaction.create(dto);

        interaction.update(dto);

        expect(interaction.changedAttributes).toEqual({});
    });

    it('returns an updated interaction response when closing with a partial payload', async () => {
        const dto = baseDto();
        const userId = uuidv4();
        const interaction = Interaction.create(dto);
        const repository = {
            calls: [],
            async find(id) {
                this.calls.push(['find', id.value]);
                return interaction;
            },
            async update(updatedInteraction) {
                this.calls.push(['update', { ...updatedInteraction.changedAttributes }]);
            },
            async saveHistory(updatedInteraction, originalValues) {
                this.calls.push(['saveHistory', updatedInteraction.id.value, originalValues.id]);
            },
        };

        const response = await new InteractionUpdater(repository).execute({ is_closed: true }, dto.id, userId);
        const responseData = response.toJson().data;

        expect(response).toBeInstanceOf(InteractionResponse);
        expect(responseData.id).toBe(dto.id);
        expect(responseData.is_closed).toBe(true);
        expect(responseData.closed_by).toBe(userId);
        expect(responseData.closed_at).toBeDefined();
        expect(repository.calls[0]).toEqual(['find', dto.id]);
        expect(repository.calls[1][0]).toBe('update');
        expect(repository.calls[2]).toEqual(['saveHistory', dto.id, dto.id]);
    });

    it('marks an Interaction instance as deleted', () => {
        const interaction = Interaction.create(baseDto());

        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
            delete_observation: 'Duplicado',
        };

        interaction.delete(deleteDto);
        interaction.delete_observation = deleteDto.delete_observation;

        expect(interaction.deleted_at.value).toEqual(deleteDto.deleted_at);
        expect(interaction.deleted_by.value).toEqual(deleteDto.deleted_by);
        expect(interaction.delete_observation.value).toEqual(deleteDto.delete_observation);
    });

    it('should throw a error if deleted fields are empty', () => {
        const interaction = Interaction.create(baseDto());

        const deleteDto = {};

        expect(() => interaction.delete(deleteDto)).toThrow(DeleteFieldsDoNotExistError);
    });

    it('flushes changes in Interaction instance', () => {
        const interaction = Interaction.create(baseDto());

        const updateDto = {
            status: 'in_review',
            priority: 'low',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };

        interaction.update(updateDto);
        interaction.flushChanges();

        expect(interaction.changedAttributes).toEqual({});
    });

    it('should update individual properties using setters', () => {
        const interaction = Interaction.create(baseDto());

        const newDescription = 'Nueva descripción usando setter';
        const in_review = true;
        const newPriority = 'urgent';

        interaction.description = newDescription;
        interaction.in_review = in_review;
        interaction.priority = newPriority;

        expect(interaction.description.value).toEqual(newDescription);
        expect(interaction.in_review.value).toEqual(in_review);
        expect(interaction.priority.value).toEqual(newPriority);
        expect(interaction.changedAttributes.description).toEqual(newDescription);
        expect(interaction.changedAttributes.in_review).toEqual(in_review);
        expect(interaction.changedAttributes.priority).toEqual(newPriority);
    });
});

describe('Interaction Responses Tests', () => {
    it('converts Interaction object to JSON representation', () => {
        const dto = {
            id: uuidv4(),
            channel_id: 'email',
            client_identifier: uuidv4(),
            external_identifier: uuidv4(),
            description: 'Primera interaction',
            priority: 'high',
            is_closed: false,
            in_review: false,
            workspace_id: uuidv4(),
            conversation_id: uuidv4(),
            created_by: uuidv4(),
            created_at: new Date().toISOString(),
            closed_observation: 'Cliente no responde',
            delete_observation: 'Duplicado',
        };

        const interaction = new Interaction(dto);
        const interactionResponse = new InteractionResponse(interaction);

        const keysExpected = [
            'id',
            'channel_id',
            'client_identifier',
            'external_identifier',
            'description',
            'priority',
            'is_closed',
            'in_review',
            'workspace_id',
            'start_review_at',
            'start_review_by',
            'created_by',
            'created_at',
            'updated_by',
            'updated_at',
            'closed_observation',
            'delete_observation',
        ];
        const keysInvalid = ['deleted_by', 'deleted_at'];

        const json = interactionResponse.toJson().data;

        expect(Object.keys(json)).toEqual(expect.arrayContaining(keysExpected));
        expect(Object.keys(json)).not.toEqual(expect.arrayContaining(keysInvalid));
    });

    it('return an empty object if Interaction is null', () => {
        const interactionResponse = new InteractionResponse(null);

        const json = interactionResponse.toJson();

        expect(json).toMatchObject({});
    });

    it('converts Interaction collection object to JSON representation', () => {
        const dto1 = {
            id: uuidv4(),
            channel_id: 'email',
            client_identifier: uuidv4(),
            external_identifier: uuidv4(),
            description: 'Primera interaction',
            priority: 'high',
            is_closed: false,
            in_review: false,
            workspace_id: uuidv4(),
            conversation_id: uuidv4(),
            created_by: uuidv4(),
            created_at: new Date().toISOString(),
        };

        const dto2 = {
            id: uuidv4(),
            channel_id: 'phone',
            client_identifier: uuidv4(),
            external_identifier: uuidv4(),
            description: 'Segunda interaction',
            priority: 'low',
            is_closed: true,
            in_review: false,
            workspace_id: uuidv4(),
            conversation_id: uuidv4(),
            created_by: uuidv4(),
            created_at: new Date().toISOString(),
        };

        const interactions = [new Interaction(dto1), new Interaction(dto2)];
        const interactionCollectionResponse = new InteractionCollectionResponse(interactions, {
            'count(*)': interactions.length,
        });

        const json = interactionCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: interactions.map((interaction) => new InteractionResponse(interaction).toJson().data),
            },
            metadata: {
                count: interactions.length,
            },
        });
    });

    it('handles empty interaction collection', () => {
        const interactions = [];
        const interactionCollectionResponse = new InteractionCollectionResponse(interactions, 0);

        const json = interactionCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: [],
            },
            metadata: {
                count: 0,
            },
        });
    });

    it('accepts repository count objects with a count property', () => {
        const interactionCollectionResponse = new InteractionCollectionResponse([], {
            count: '12',
        });

        const json = interactionCollectionResponse.toJson();

        expect(json.metadata.count).toBe(12);
    });
});

const buildSchemaRecordingConnection = () => {
    const tableNames = [];
    const operations = [];

    class FakeQueryBuilder {
        constructor(tableName) {
            this.tableName = tableName;
        }

        select(...columns) {
            operations.push(['select', this.tableName, columns]);
            return this;
        }

        where(condition) {
            operations.push(['where', this.tableName, condition]);
            return this;
        }

        whereIn(column, values) {
            operations.push(['whereIn', this.tableName, column, values]);
            return this;
        }

        whereNull(column) {
            operations.push(['whereNull', this.tableName, column]);
            return this;
        }

        orderBy(column) {
            operations.push(['orderBy', this.tableName, column]);
            return this;
        }

        first() {
            operations.push(['first', this.tableName]);
            return this;
        }

        forUpdate() {
            operations.push(['forUpdate', this.tableName]);
            return this;
        }

        update(values) {
            operations.push(['update', this.tableName, values]);
            return Promise.resolve(1);
        }

        insert(payload) {
            operations.push(['insert', this.tableName, payload]);
            return Promise.resolve();
        }

        then(resolve, reject) {
            return Promise.resolve([{ id: 'interaction-id' }]).then(resolve, reject);
        }
    }

    const connection = jest.fn((tableName) => {
        tableNames.push(tableName);
        return new FakeQueryBuilder(tableName);
    });

    connection.client = {
        config: {
            client: 'pg',
            schema: 'tenant_schema',
        },
        on: jest.fn(),
    };

    return { connection, tableNames, operations };
};

describe('KnexInteractionRepository', () => {
    it('uses tenant-qualified tables for transactional review persistence queries', async () => {
        const { connection, tableNames } = buildSchemaRecordingConnection();
        const repository = new KnexInteractionRepository(connection);
        const trx = connection;

        await repository.findByIdForReview('interaction-id', { trx, forUpdate: true });
        await repository.updateReviewFields('interaction-id', { in_review: true }, { trx });
        await repository.bulkSaveInteractionHistory([{ id: 'interaction-id' }], { updated_by: 'user-id' }, { trx });

        expect(tableNames).toEqual([
            'tenant_schema.interactions',
            'tenant_schema.interactions',
            'tenant_schema.history_interactions',
        ]);
    });

    it('uses tenant-qualified tables for transactional bulk workspace and linked-email queries', async () => {
        const { connection, tableNames } = buildSchemaRecordingConnection();
        const repository = new KnexInteractionRepository(connection);
        const trx = connection;
        const interactions = [{ id: 'interaction-id', email_id: 'email-id' }];

        await repository.findByIds(['interaction-id'], { trx, forUpdate: true });
        await repository.findActiveWorkspaceById('workspace-id', { trx });
        await repository.bulkMove(['interaction-id'], { workspace_id: 'workspace-id' }, { trx });
        await repository.bulkMoveLinkedEmails(interactions, { workspace_id: 'workspace-id' }, { trx });
        await repository.bulkSoftDeleteLinkedEmailAggregate(
            interactions,
            { deleted_at: 'now', deleted_by: 'user-id' },
            { trx }
        );

        expect(tableNames).toEqual([
            'tenant_schema.interactions',
            'tenant_schema.workspaces',
            'tenant_schema.interactions',
            'tenant_schema.emails',
            'tenant_schema.emails',
            'tenant_schema.emails_body',
            'tenant_schema.emails_attachments',
        ]);
    });
});

describe('Interaction bulk use cases', () => {
    const user = () => ({ id: { value: uuidv4() } });
    const interactionRow = (overrides = {}) => ({
        id: overrides.id ?? uuidv4(),
        channel_id: overrides.channel_id ?? 'email',
        client_identifier: overrides.client_identifier ?? uuidv4(),
        external_identifier: overrides.external_identifier ?? uuidv4(),
        description: overrides.description ?? 'Interaction de prueba',
        priority: overrides.priority ?? 'high',
        workspace_id: overrides.workspace_id ?? uuidv4(),
        email_id: Object.prototype.hasOwnProperty.call(overrides, 'email_id') ? overrides.email_id : uuidv4(),
        is_closed: overrides.is_closed ?? false,
        in_review: overrides.in_review ?? false,
        start_review_at: Object.prototype.hasOwnProperty.call(overrides, 'start_review_at')
            ? overrides.start_review_at
            : null,
        start_review_by: Object.prototype.hasOwnProperty.call(overrides, 'start_review_by')
            ? overrides.start_review_by
            : null,
        conversation_id: overrides.conversation_id ?? uuidv4(),
        receipt_at: Object.prototype.hasOwnProperty.call(overrides, 'receipt_at') ? overrides.receipt_at : null,
        closed_at: overrides.closed_at ?? null,
        closed_by: overrides.closed_by ?? null,
        deleted_at: overrides.deleted_at ?? null,
        deleted_by: overrides.deleted_by ?? null,
        created_at: overrides.created_at ?? new Date().toISOString(),
        created_by: overrides.created_by ?? uuidv4(),
    });

    class FakeInteractionRepository {
        constructor({ rows = [], activeWorkspaceIds = [], scopedRowIds = null, scopedWorkspaceIds = null } = {}) {
            this.rows = rows;
            this.activeWorkspaceIds = new Set(activeWorkspaceIds);
            this.scopedRowIds = scopedRowIds === null ? null : new Set(scopedRowIds);
            this.scopedWorkspaceIds = scopedWorkspaceIds === null ? null : new Set(scopedWorkspaceIds);
            this.calls = [];
            this.lastBulkValues = null;
            this.lastLinkedEmailMove = null;
            this.lastLinkedEmailDelete = null;
        }

        async withTransaction(callback) {
            this.calls.push(['withTransaction']);
            return callback('trx');
        }

        async findByIds(ids, options = {}) {
            this.calls.push(['findByIds', ids, options]);
            return this.rows.filter((row) => ids.includes(row.id));
        }

        async findByIdsForActiveGroup(ids, scope, options = {}) {
            this.calls.push(['findByIdsForActiveGroup', ids, scope, options]);
            return this.rows.filter(
                (row) =>
                    ids.includes(row.id) &&
                    !row.deleted_at &&
                    !row.deleted_by &&
                    (this.scopedRowIds === null || this.scopedRowIds.has(row.id))
            );
        }

        async findByIdForReview(id, options = {}) {
            this.calls.push(['findByIdForReview', id, options]);
            return this.rows.find((row) => row.id === id && !row.deleted_at) ?? null;
        }

        async findByIdForActiveGroup(id, scope, options = {}) {
            this.calls.push(['findByIdForActiveGroup', id, scope, options]);
            return (
                this.rows.find(
                    (row) =>
                        row.id === id &&
                        !row.deleted_at &&
                        !row.deleted_by &&
                        (this.scopedRowIds === null || this.scopedRowIds.has(row.id))
                ) ?? null
            );
        }

        async findActiveWorkspaceById(workspaceId, options = {}) {
            this.calls.push(['findActiveWorkspaceById', workspaceId, options]);
            return this.activeWorkspaceIds.has(workspaceId) ? { id: workspaceId } : null;
        }

        async findActiveWorkspaceByIdForActiveGroup(workspaceId, scope, options = {}) {
            this.calls.push(['findActiveWorkspaceByIdForActiveGroup', workspaceId, scope, options]);
            const isScoped = this.scopedWorkspaceIds === null || this.scopedWorkspaceIds.has(workspaceId);
            return this.activeWorkspaceIds.has(workspaceId) && isScoped ? { id: workspaceId } : null;
        }

        async findEligibleAgentMoveDestinationById(workspaceId, options = {}) {
            this.calls.push(['findEligibleAgentMoveDestinationById', workspaceId, options]);
            return this.activeWorkspaceIds.has(workspaceId) ? { id: workspaceId } : null;
        }

        async findEligibleAgentMoveDestinations(currentWorkspaceId) {
            this.calls.push(['findEligibleAgentMoveDestinations', currentWorkspaceId]);
            return [{ id: uuidv4(), description: 'Other group workspace' }];
        }

        async bulkMove(ids, values, options = {}) {
            this.calls.push(['bulkMove', ids, values, options]);
            this.lastBulkValues = values;
        }

        async bulkClose(ids, values, options = {}) {
            this.calls.push(['bulkClose', ids, values, options]);
            this.lastBulkValues = values;
        }

        async bulkDelete(ids, values, options = {}) {
            this.calls.push(['bulkDelete', ids, values, options]);
            this.lastBulkValues = values;
        }

        async updateReviewFields(id, values, options = {}) {
            this.calls.push(['updateReviewFields', id, values, options]);
            this.lastBulkValues = values;
            const index = this.rows.findIndex((row) => row.id === id);
            if (index !== -1) this.rows[index] = { ...this.rows[index], ...values };
            return index === -1 ? 0 : 1;
        }

        async bulkMoveLinkedEmails(rows, values, options = {}) {
            this.calls.push(['bulkMoveLinkedEmails', rows, values, options]);
            this.lastLinkedEmailMove = { rows, values, options };
        }

        async bulkSoftDeleteLinkedEmailAggregate(rows, values, options = {}) {
            this.calls.push(['bulkSoftDeleteLinkedEmailAggregate', rows, values, options]);
            this.lastLinkedEmailDelete = { rows, values, options };
        }

        async bulkSaveInteractionHistory(rows, values, options = {}) {
            this.calls.push(['bulkSaveInteractionHistory', rows, values, options]);
        }
    }

    class FakeLiteralRepository {
        constructor(validMotives = []) {
            this.validMotives = new Set(validMotives);
            this.calls = [];
        }

        async findActiveOptionByPath(modelName, fieldName, optionName) {
            this.calls.push([modelName, fieldName, optionName]);
            return this.validMotives.has(optionName) ? { nombre: optionName } : null;
        }
    }

    it('moves deduped interactions in a transaction and writes history', async () => {
        const originWorkspaceId = uuidv4();
        const destinationWorkspaceId = uuidv4();
        const first = interactionRow({ workspace_id: originWorkspaceId });
        const second = interactionRow({ workspace_id: originWorkspaceId });
        const repository = new FakeInteractionRepository({
            rows: [first, second],
            activeWorkspaceIds: [destinationWorkspaceId],
        });

        const result = await new InteractionBulkMover(repository, user()).execute({
            interaction_ids: [first.id, second.id, first.id],
            workspace_id: destinationWorkspaceId,
        });

        expect(result).toEqual({ updated: 2 });
        expect(repository.calls[1]).toEqual(['findActiveWorkspaceById', destinationWorkspaceId, { trx: 'trx' }]);
        expect(repository.calls[2][0]).toBe('findByIds');
        expect(repository.calls[2][1]).toEqual([first.id, second.id]);
        expect(repository.calls[2][2]).toEqual({ trx: 'trx', forUpdate: true });
        const bulkMoveCall = repository.calls.find((call) => call[0] === 'bulkMove');
        const linkedEmailMoveCall = repository.calls.find((call) => call[0] === 'bulkMoveLinkedEmails');
        const historyCall = repository.calls.find((call) => call[0] === 'bulkSaveInteractionHistory');

        expect(bulkMoveCall).toBeDefined();
        expect(linkedEmailMoveCall).toBeDefined();
        expect(historyCall).toBeDefined();
        expect(linkedEmailMoveCall[1]).toEqual([first, second]);
        expect(linkedEmailMoveCall[2]).toEqual(repository.lastBulkValues);
        expect(linkedEmailMoveCall[3]).toEqual({ trx: 'trx' });
        expect(repository.lastBulkValues.workspace_id).toBe(destinationWorkspaceId);
        expect(repository.lastBulkValues.updated_by).toBeDefined();
        expect(repository.lastBulkValues.updated_at).toBeDefined();
    });

    it('moves only interactions that are not already in the destination workspace', async () => {
        const originWorkspaceId = uuidv4();
        const destinationWorkspaceId = uuidv4();
        const alreadyInDestination = interactionRow({ workspace_id: destinationWorkspaceId });
        const changingWorkspace = interactionRow({ workspace_id: originWorkspaceId });
        const repository = new FakeInteractionRepository({
            rows: [alreadyInDestination, changingWorkspace],
            activeWorkspaceIds: [destinationWorkspaceId],
        });

        const result = await new InteractionBulkMover(repository, user()).execute({
            interaction_ids: [alreadyInDestination.id, changingWorkspace.id],
            workspace_id: destinationWorkspaceId,
        });

        const bulkMoveCall = repository.calls.find((call) => call[0] === 'bulkMove');
        const historyCall = repository.calls.find((call) => call[0] === 'bulkSaveInteractionHistory');
        const linkedEmailMoveCall = repository.calls.find((call) => call[0] === 'bulkMoveLinkedEmails');

        expect(result).toEqual({ updated: 1 });
        expect(bulkMoveCall[1]).toEqual([changingWorkspace.id]);
        expect(historyCall[1].map((row) => row.id)).toEqual([changingWorkspace.id]);
        expect(linkedEmailMoveCall[1]).toEqual([changingWorkspace]);
        expect(linkedEmailMoveCall[2].workspace_id).toBe(destinationWorkspaceId);
    });

    it('moves interactions without email ids without failing', async () => {
        const originWorkspaceId = uuidv4();
        const destinationWorkspaceId = uuidv4();
        const row = interactionRow({ workspace_id: originWorkspaceId, email_id: null });
        const repository = new FakeInteractionRepository({
            rows: [row],
            activeWorkspaceIds: [destinationWorkspaceId],
        });

        const result = await new InteractionBulkMover(repository, user()).execute({
            interaction_ids: [row.id],
            workspace_id: destinationWorkspaceId,
        });

        const linkedEmailMoveCall = repository.calls.find((call) => call[0] === 'bulkMoveLinkedEmails');

        expect(result).toEqual({ updated: 1 });
        expect(linkedEmailMoveCall[1]).toEqual([row]);
    });

    it('preserves generic admin destination behavior, including canonical System Inbox', async () => {
        const row = interactionRow();
        const repository = new FakeInteractionRepository({
            rows: [row],
            activeWorkspaceIds: [SYSTEM_INBOX_WORKSPACE_ID],
        });

        await expect(
            new InteractionBulkMover(repository, user()).execute({
                interaction_ids: [row.id],
                workspace_id: SYSTEM_INBOX_WORKSPACE_ID,
            })
        ).resolves.toEqual({ updated: 1 });
        expect(repository.calls[1]).toEqual(['findActiveWorkspaceById', SYSTEM_INBOX_WORKSPACE_ID, { trx: 'trx' }]);
        expect(repository.calls[2]).toEqual(['findByIds', [row.id], { trx: 'trx', forUpdate: true }]);
    });

    it('rejects moving when every interaction is already in the destination workspace', async () => {
        const workspaceId = uuidv4();
        const row = interactionRow({ workspace_id: workspaceId });
        const repository = new FakeInteractionRepository({
            rows: [row],
            activeWorkspaceIds: [workspaceId],
        });

        await expect(
            new InteractionBulkMover(repository, user()).execute({
                interaction_ids: [row.id],
                workspace_id: workspaceId,
            })
        ).rejects.toThrow(CustomError);
    });

    it('rejects moving deleted interactions', async () => {
        const originWorkspaceId = uuidv4();
        const destinationWorkspaceId = uuidv4();
        const row = interactionRow({
            workspace_id: originWorkspaceId,
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        });
        const repository = new FakeInteractionRepository({
            rows: [row],
            activeWorkspaceIds: [destinationWorkspaceId],
        });

        await expect(
            new InteractionBulkMover(repository, user()).execute({
                interaction_ids: [row.id],
                workspace_id: destinationWorkspaceId,
            })
        ).rejects.toThrow(CustomError);
    });

    it('allows an eligible out-of-group destination while keeping the source scoped', async () => {
        const originWorkspaceId = uuidv4();
        const destinationWorkspaceId = uuidv4();
        const row = interactionRow({ workspace_id: originWorkspaceId });
        const repository = new FakeInteractionRepository({
            rows: [row],
            activeWorkspaceIds: [destinationWorkspaceId],
            scopedRowIds: [row.id],
            scopedWorkspaceIds: [],
        });
        const scope = { userId: uuidv4(), activeGroupId: uuidv4() };

        await expect(
            new InteractionBulkMover(repository, user()).execute(
                { interaction_ids: [row.id], workspace_id: destinationWorkspaceId },
                scope
            )
        ).resolves.toEqual({ updated: 1 });
        expect(repository.calls).toContainEqual([
            'findEligibleAgentMoveDestinationById',
            destinationWorkspaceId,
            { trx: 'trx', forUpdate: true },
        ]);
        expect(repository.calls).toContainEqual([
            'findByIdsForActiveGroup',
            [row.id],
            scope,
            { trx: 'trx', forUpdate: true },
        ]);
        expect(repository.calls.some((call) => call[0] === 'bulkMove')).toBe(true);
        expect(repository.calls.findIndex((call) => call[0] === 'findByIdsForActiveGroup')).toBeLessThan(
            repository.calls.findIndex((call) => call[0] === 'findEligibleAgentMoveDestinationById')
        );
    });

    it.each([
        ['missing', uuidv4()],
        ['inactive', uuidv4()],
        ['deleted', uuidv4()],
        ['System Inbox', SYSTEM_INBOX_WORKSPACE_ID],
    ])('rejects an Agent %s destination generically without writes', async (_label, destinationWorkspaceId) => {
        const row = interactionRow();
        const scope = { userId: uuidv4(), activeGroupId: uuidv4() };
        const repository = new FakeInteractionRepository({ rows: [row], scopedRowIds: [row.id] });

        await expect(
            new InteractionBulkMover(repository, user()).execute(
                { interaction_ids: [row.id], workspace_id: destinationWorkspaceId },
                scope
            )
        ).rejects.toMatchObject({ statusCode: 404, message: 'Interaction not found' });
        expect(repository.calls[1][0]).toBe('findByIdsForActiveGroup');
        expect(repository.calls[2][0]).toBe('findEligibleAgentMoveDestinationById');
        expect(repository.calls.some((call) => call[0] === 'bulkMove')).toBe(false);
        expect(repository.calls.some((call) => call[0] === 'bulkSaveInteractionHistory')).toBe(false);
    });

    it('rejects an Agent mixed current-and-changing destination batch atomically with a generic 404', async () => {
        const destinationWorkspaceId = uuidv4();
        const alreadyInDestination = interactionRow({ workspace_id: destinationWorkspaceId });
        const changingWorkspace = interactionRow();
        const scope = { userId: uuidv4(), activeGroupId: uuidv4() };
        const repository = new FakeInteractionRepository({
            rows: [alreadyInDestination, changingWorkspace],
            activeWorkspaceIds: [destinationWorkspaceId],
            scopedRowIds: [alreadyInDestination.id, changingWorkspace.id],
        });

        await expect(
            new InteractionBulkMover(repository, user()).execute(
                {
                    interaction_ids: [alreadyInDestination.id, changingWorkspace.id],
                    workspace_id: destinationWorkspaceId,
                },
                scope
            )
        ).rejects.toMatchObject({ statusCode: 404, message: 'Interaction not found' });
        expect(repository.calls.some((call) => call[0] === 'bulkMove')).toBe(false);
        expect(repository.calls.some((call) => call[0] === 'bulkMoveLinkedEmails')).toBe(false);
        expect(repository.calls.some((call) => call[0] === 'bulkSaveInteractionHistory')).toBe(false);
    });

    it('hides move destinations when the source interaction is outside the active group', async () => {
        const row = interactionRow();
        const repository = new FakeInteractionRepository({ rows: [row], scopedRowIds: [] });

        await expect(
            new AgentMoveDestinationFinder(repository).execute(row.id, {
                userId: uuidv4(),
                activeGroupId: uuidv4(),
            })
        ).rejects.toMatchObject({ statusCode: 404, message: 'Interaction not found' });
        expect(repository.calls.some((call) => call[0] === 'findEligibleAgentMoveDestinations')).toBe(false);
    });

    it('lists minimal move destinations only after authorizing the scoped source', async () => {
        const row = interactionRow();
        const repository = new FakeInteractionRepository({ rows: [row], scopedRowIds: [row.id] });
        const scope = { userId: uuidv4(), activeGroupId: uuidv4() };

        const result = await new AgentMoveDestinationFinder(repository).execute(row.id, scope);

        expect(result).toEqual([{ id: expect.any(String), description: 'Other group workspace' }]);
        expect(repository.calls[0]).toEqual(['findByIdForActiveGroup', row.id, scope, {}]);
        expect(repository.calls[1]).toEqual(['findEligibleAgentMoveDestinations', row.workspace_id]);
    });

    it('rejects a mixed scoped move batch atomically with a generic 404', async () => {
        const destinationWorkspaceId = uuidv4();
        const inScope = interactionRow();
        const outOfScope = interactionRow();
        const repository = new FakeInteractionRepository({
            rows: [inScope, outOfScope],
            activeWorkspaceIds: [destinationWorkspaceId],
            scopedRowIds: [inScope.id],
            scopedWorkspaceIds: [destinationWorkspaceId],
        });
        const scope = { userId: uuidv4(), activeGroupId: uuidv4() };

        await expect(
            new InteractionBulkMover(repository, user()).execute(
                { interaction_ids: [inScope.id, outOfScope.id], workspace_id: destinationWorkspaceId },
                scope
            )
        ).rejects.toMatchObject({ statusCode: 404, message: 'Interaction not found' });
        expect(repository.calls).toContainEqual([
            'findByIdsForActiveGroup',
            [inScope.id, outOfScope.id],
            scope,
            { trx: 'trx', forUpdate: true },
        ]);
        expect(repository.calls.some((call) => call[0] === 'bulkMove')).toBe(false);
        expect(repository.calls.some((call) => call[0] === 'bulkSaveInteractionHistory')).toBe(false);
    });

    it('closes interactions with a literal-backed motive and writes history', async () => {
        const row = interactionRow({ in_review: true });
        const repository = new FakeInteractionRepository({ rows: [row] });
        const literalRepository = new FakeLiteralRepository(['Cliente no responde']);

        const result = await new InteractionBulkCloser(repository, literalRepository, user()).execute({
            interaction_ids: [row.id],
            motive: 'Cliente no responde',
        });

        expect(result).toEqual({ updated: 1 });
        expect(literalRepository.calls).toEqual([['interactions', 'closed_observation', 'Cliente no responde']]);
        expect(repository.calls[2][0]).toBe('bulkClose');
        expect(repository.calls[3][0]).toBe('bulkSaveInteractionHistory');
        expect(repository.lastBulkValues).toEqual(
            expect.objectContaining({
                is_closed: true,
                in_review: false,
                closed_by: expect.any(String),
                updated_by: expect.any(String),
                closed_observation: 'Cliente no responde',
            })
        );
        expect(repository.lastBulkValues.closed_at).toBeDefined();
        expect(repository.lastBulkValues.updated_at).toBeDefined();
    });

    it('does not touch linked emails when closing interactions', async () => {
        const row = interactionRow({ in_review: true });
        const repository = new FakeInteractionRepository({ rows: [row] });
        const literalRepository = new FakeLiteralRepository(['Cliente no responde']);

        await new InteractionBulkCloser(repository, literalRepository, user()).execute({
            interaction_ids: [row.id],
            motive: 'Cliente no responde',
        });

        expect(repository.calls.some((call) => call[0] === 'bulkMoveLinkedEmails')).toBe(false);
        expect(repository.calls.some((call) => call[0] === 'bulkSoftDeleteLinkedEmailAggregate')).toBe(false);
    });

    it('rejects closing deleted or already closed interactions', async () => {
        const repository = new FakeInteractionRepository({
            rows: [interactionRow({ is_closed: true })],
        });
        const literalRepository = new FakeLiteralRepository(['Cliente no responde']);

        await expect(
            new InteractionBulkCloser(repository, literalRepository, user()).execute({
                interaction_ids: [repository.rows[0].id],
                motive: 'Cliente no responde',
            })
        ).rejects.toThrow(CustomError);
    });

    it('rejects closing deleted interactions independently from already-closed interactions', async () => {
        const deletedRow = interactionRow({
            is_closed: false,
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        });
        const repository = new FakeInteractionRepository({ rows: [deletedRow] });
        const literalRepository = new FakeLiteralRepository(['Cliente no responde']);

        await expect(
            new InteractionBulkCloser(repository, literalRepository, user()).execute({
                interaction_ids: [deletedRow.id],
                motive: 'Cliente no responde',
            })
        ).rejects.toThrow(CustomError);
    });

    it('rejects a mixed scoped close batch atomically with a generic 404', async () => {
        const inScope = interactionRow();
        const outOfScope = interactionRow();
        const repository = new FakeInteractionRepository({
            rows: [inScope, outOfScope],
            scopedRowIds: [inScope.id],
        });
        const literalRepository = new FakeLiteralRepository(['Cliente no responde']);
        const scope = { userId: uuidv4(), activeGroupId: uuidv4() };

        await expect(
            new InteractionBulkCloser(repository, literalRepository, user()).execute(
                { interaction_ids: [inScope.id, outOfScope.id], motive: 'Cliente no responde' },
                scope
            )
        ).rejects.toMatchObject({ statusCode: 404, message: 'Interaction not found' });
        expect(repository.calls).toContainEqual([
            'findByIdsForActiveGroup',
            [inScope.id, outOfScope.id],
            scope,
            { trx: 'trx', forUpdate: true },
        ]);
        expect(repository.calls.some((call) => call[0] === 'bulkClose')).toBe(false);
        expect(repository.calls.some((call) => call[0] === 'bulkSaveInteractionHistory')).toBe(false);
    });

    it('deletes interactions with a literal-backed motive and writes history', async () => {
        const row = interactionRow();
        const repository = new FakeInteractionRepository({ rows: [row] });
        const literalRepository = new FakeLiteralRepository(['Duplicado']);

        const result = await new InteractionBulkDeleter(repository, literalRepository, user()).execute({
            interaction_ids: [row.id],
            motive: 'Duplicado',
        });

        expect(result).toEqual({ updated: 1 });
        // Product decision: delete motives intentionally reuse the close-observation literal path.
        expect(literalRepository.calls).toEqual([['interactions', 'closed_observation', 'Duplicado']]);
        const bulkDeleteCall = repository.calls.find((call) => call[0] === 'bulkDelete');
        const linkedEmailDeleteCall = repository.calls.find((call) => call[0] === 'bulkSoftDeleteLinkedEmailAggregate');
        const historyCall = repository.calls.find((call) => call[0] === 'bulkSaveInteractionHistory');

        expect(bulkDeleteCall).toBeDefined();
        expect(linkedEmailDeleteCall).toBeDefined();
        expect(historyCall).toBeDefined();
        expect(linkedEmailDeleteCall[1]).toEqual([row]);
        expect(linkedEmailDeleteCall[2]).toEqual(repository.lastBulkValues);
        expect(linkedEmailDeleteCall[3]).toEqual({ trx: 'trx' });
        expect(repository.lastBulkValues).toEqual(
            expect.objectContaining({
                deleted_by: expect.any(String),
                delete_observation: 'Duplicado',
            })
        );
        expect(repository.lastBulkValues.deleted_at).toBeDefined();
    });

    it('deletes interactions without email ids without failing', async () => {
        const row = interactionRow({ email_id: null });
        const repository = new FakeInteractionRepository({ rows: [row] });
        const literalRepository = new FakeLiteralRepository(['Duplicado']);

        const result = await new InteractionBulkDeleter(repository, literalRepository, user()).execute({
            interaction_ids: [row.id],
            motive: 'Duplicado',
        });

        const linkedEmailDeleteCall = repository.calls.find((call) => call[0] === 'bulkSoftDeleteLinkedEmailAggregate');

        expect(result).toEqual({ updated: 1 });
        expect(linkedEmailDeleteCall[1]).toEqual([row]);
    });

    it('rejects empty and over-500 batches as validation failures', async () => {
        const repository = new FakeInteractionRepository({ rows: [] });
        const literalRepository = new FakeLiteralRepository([]);
        const closer = new InteractionBulkCloser(repository, literalRepository, user());

        await expect(closer.execute({ interaction_ids: [], motive: 'x' })).rejects.toThrow(ValidationFailError);
        await expect(
            closer.execute({ interaction_ids: Array.from({ length: 501 }, () => uuidv4()), motive: 'x' })
        ).rejects.toThrow(ValidationFailError);
    });

    it('rejects invalid motives, missing rows, and already deleted rows with domain errors', async () => {
        const repository = new FakeInteractionRepository({ rows: [] });
        const literalRepository = new FakeLiteralRepository([]);
        const closer = new InteractionBulkCloser(repository, literalRepository, user());

        await expect(closer.execute({ interaction_ids: [uuidv4()], motive: 'Invalido' })).rejects.toThrow(CustomError);

        const missingRowLiteralRepository = new FakeLiteralRepository(['Cliente no responde']);
        // Missing existing rows is a domain/not-found failure in this codebase, so it remains a CustomError.
        await expect(
            new InteractionBulkCloser(repository, missingRowLiteralRepository, user()).execute({
                interaction_ids: [uuidv4()],
                motive: 'Cliente no responde',
            })
        ).rejects.toMatchObject({
            constructor: CustomError,
            message: expect.stringContaining('Interactions not found'),
        });

        const deletedRow = interactionRow({ deleted_at: new Date().toISOString(), deleted_by: uuidv4() });
        const deleteRepository = new FakeInteractionRepository({ rows: [deletedRow] });
        const deleteLiteralRepository = new FakeLiteralRepository(['Duplicado']);

        await expect(
            new InteractionBulkDeleter(deleteRepository, deleteLiteralRepository, user()).execute({
                interaction_ids: [deletedRow.id],
                motive: 'Duplicado',
            })
        ).rejects.toThrow(CustomError);
    });

    it('claims a free interaction for current user and writes history', async () => {
        const currentUser = user();
        const row = interactionRow();
        const repository = new FakeInteractionRepository({ rows: [row] });

        const result = await new InteractionReviewClaimer(repository, currentUser).execute(row.id);

        expect(result.data.in_review).toBe(true);
        expect(result.data.start_review_by).toBe(currentUser.id.value);
        expect(result.data.start_review_at).toBeDefined();
        const updateCall = repository.calls.find((call) => call[0] === 'updateReviewFields');
        const historyCall = repository.calls.find((call) => call[0] === 'bulkSaveInteractionHistory');
        expect(updateCall).toBeDefined();
        expect(updateCall[1]).toBe(row.id);
        expect(updateCall[2]).toEqual(
            expect.objectContaining({
                in_review: true,
                start_review_by: currentUser.id.value,
                updated_by: currentUser.id.value,
            })
        );
        expect(updateCall[2].start_review_at).toBeDefined();
        expect(updateCall[2].updated_at).toBeDefined();
        expect(updateCall[3]).toEqual({ trx: 'trx' });
        expect(historyCall).toEqual(['bulkSaveInteractionHistory', [row], updateCall[2], { trx: 'trx' }]);
    });

    it('claim by same reviewer is idempotent and does not update or write history', async () => {
        const currentUser = user();
        const row = interactionRow({
            in_review: true,
            start_review_by: currentUser.id.value,
            start_review_at: new Date().toISOString(),
        });
        const repository = new FakeInteractionRepository({ rows: [row] });

        const result = await new InteractionReviewClaimer(repository, currentUser).execute(row.id);

        expect(result.data.in_review).toBe(true);
        expect(result.data.start_review_by).toBe(currentUser.id.value);
        expect(repository.calls.some((call) => call[0] === 'updateReviewFields')).toBe(false);
        expect(repository.calls.some((call) => call[0] === 'bulkSaveInteractionHistory')).toBe(false);
    });

    it('claim by another reviewer rejects with conflict', async () => {
        const row = interactionRow({
            in_review: true,
            start_review_by: uuidv4(),
            start_review_at: new Date().toISOString(),
        });
        const repository = new FakeInteractionRepository({ rows: [row] });

        await expect(new InteractionReviewClaimer(repository, user()).execute(row.id)).rejects.toMatchObject({
            statusCode: 409,
        });
    });

    it('claim on closed interaction rejects as invalid', async () => {
        const row = interactionRow({ is_closed: true });
        const repository = new FakeInteractionRepository({ rows: [row] });

        await expect(new InteractionReviewClaimer(repository, user()).execute(row.id)).rejects.toMatchObject({
            statusCode: 400,
        });
    });

    it('claim on a missing interaction rejects as not found without updating', async () => {
        const repository = new FakeInteractionRepository({ rows: [] });

        await expect(new InteractionReviewClaimer(repository, user()).execute(uuidv4())).rejects.toMatchObject({
            statusCode: 404,
        });
        expect(repository.calls.some((call) => call[0] === 'updateReviewFields')).toBe(false);
        expect(repository.calls.some((call) => call[0] === 'bulkSaveInteractionHistory')).toBe(false);
    });

    it('claim scopes the writer lookup and hides an out-of-scope interaction as not found', async () => {
        const row = interactionRow();
        const repository = new FakeInteractionRepository({ rows: [row], scopedRowIds: [] });
        const scope = { userId: uuidv4(), activeGroupId: uuidv4() };

        await expect(new InteractionReviewClaimer(repository, user()).execute(row.id, scope)).rejects.toMatchObject({
            statusCode: 404,
            message: 'Interaction not found',
        });
        expect(repository.calls).toContainEqual([
            'findByIdForActiveGroup',
            row.id,
            scope,
            { trx: 'trx', forUpdate: true },
        ]);
        expect(repository.calls.some((call) => call[0] === 'updateReviewFields')).toBe(false);
    });

    it('release by owning reviewer clears review fields and sets updated_by', async () => {
        const currentUser = user();
        const row = interactionRow({
            in_review: true,
            start_review_by: currentUser.id.value,
            start_review_at: new Date().toISOString(),
        });
        const repository = new FakeInteractionRepository({ rows: [row] });

        const result = await new InteractionReviewReleaser(repository, currentUser).execute(row.id);

        expect(result.data.in_review).toBe(false);
        expect(result.data.start_review_by).toBeNull();
        expect(result.data.start_review_at).toBeNull();
        const updateCall = repository.calls.find((call) => call[0] === 'updateReviewFields');
        expect(updateCall[2]).toEqual(
            expect.objectContaining({
                in_review: false,
                start_review_by: null,
                start_review_at: null,
                updated_by: currentUser.id.value,
            })
        );
        expect(updateCall[2].updated_at).toBeDefined();
        expect(repository.calls.some((call) => call[0] === 'bulkSaveInteractionHistory')).toBe(true);
    });

    it('release by admin with interaction update permission can release another reviewer', async () => {
        const permissionCalls = [];
        const currentUser = {
            id: { value: uuidv4() },
            hasPermission: (...args) => {
                permissionCalls.push(args);
                return true;
            },
        };
        const row = interactionRow({
            in_review: true,
            start_review_by: uuidv4(),
            start_review_at: new Date().toISOString(),
        });
        const repository = new FakeInteractionRepository({ rows: [row] });

        const result = await new InteractionReviewReleaser(repository, currentUser).execute(row.id);

        expect(result.data.in_review).toBe(false);
        expect(permissionCalls).toEqual([['administrador', 'interactions', 'InteractionsUpdate']]);
        expect(repository.calls.some((call) => call[0] === 'updateReviewFields')).toBe(true);
    });

    it('release by non-owner without admin update permission rejects as forbidden', async () => {
        const currentUser = {
            id: { value: uuidv4() },
            hasPermission: () => false,
        };
        const row = interactionRow({
            in_review: true,
            start_review_by: uuidv4(),
            start_review_at: new Date().toISOString(),
        });
        const repository = new FakeInteractionRepository({ rows: [row] });

        await expect(new InteractionReviewReleaser(repository, currentUser).execute(row.id)).rejects.toMatchObject({
            statusCode: 403,
        });
    });

    it('release by non-owner with missing role fallback rejects as forbidden without updating', async () => {
        const currentUser = {
            id: { value: uuidv4() },
            hasPermission: () => {
                throw new Error('Role not found');
            },
        };
        const row = interactionRow({
            in_review: true,
            start_review_by: uuidv4(),
            start_review_at: new Date().toISOString(),
        });
        const repository = new FakeInteractionRepository({ rows: [row] });

        await expect(new InteractionReviewReleaser(repository, currentUser).execute(row.id)).rejects.toMatchObject({
            statusCode: 403,
        });
        expect(repository.calls.some((call) => call[0] === 'updateReviewFields')).toBe(false);
        expect(repository.calls.some((call) => call[0] === 'bulkSaveInteractionHistory')).toBe(false);
    });

    it('release on a missing interaction rejects as not found without updating', async () => {
        const repository = new FakeInteractionRepository({ rows: [] });

        await expect(new InteractionReviewReleaser(repository, user()).execute(uuidv4())).rejects.toMatchObject({
            statusCode: 404,
        });
        expect(repository.calls.some((call) => call[0] === 'updateReviewFields')).toBe(false);
        expect(repository.calls.some((call) => call[0] === 'bulkSaveInteractionHistory')).toBe(false);
    });

    it('release scopes the writer lookup and hides an out-of-scope interaction as not found', async () => {
        const currentUser = user();
        const row = interactionRow({
            in_review: true,
            start_review_by: currentUser.id.value,
            start_review_at: new Date().toISOString(),
        });
        const repository = new FakeInteractionRepository({ rows: [row], scopedRowIds: [] });
        const scope = { userId: uuidv4(), activeGroupId: uuidv4() };

        await expect(
            new InteractionReviewReleaser(repository, currentUser).execute(row.id, scope)
        ).rejects.toMatchObject({
            statusCode: 404,
            message: 'Interaction not found',
        });
        expect(repository.calls).toContainEqual([
            'findByIdForActiveGroup',
            row.id,
            scope,
            { trx: 'trx', forUpdate: true },
        ]);
        expect(repository.calls.some((call) => call[0] === 'updateReviewFields')).toBe(false);
        expect(repository.calls.some((call) => call[0] === 'bulkSaveInteractionHistory')).toBe(false);
    });

    it('release on a free interaction is idempotent and does not update', async () => {
        const row = interactionRow({ in_review: false });
        const repository = new FakeInteractionRepository({ rows: [row] });

        const result = await new InteractionReviewReleaser(repository, user()).execute(row.id);

        expect(result.data.in_review).toBe(false);
        expect(repository.calls.some((call) => call[0] === 'updateReviewFields')).toBe(false);
        expect(repository.calls.some((call) => call[0] === 'bulkSaveInteractionHistory')).toBe(false);
    });
});
