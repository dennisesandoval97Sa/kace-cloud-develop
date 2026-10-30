import { v4 as uuidV4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { CustomError } from '../../src/shared/index.js';
import { Interaction } from '../../src/interactions/domain/Interaction.js';
import { InteractionCollectionResponse } from '../../src/interactions/application/InteractionCollectionResponse.js';
import { InteractionCreator } from '../../src/interactions/application/create/InteractionCreator.js';
import { InteractionFinder } from '../../src/interactions/application/find/InteractionFinder.js';
import { InteractionUpdater } from '../../src/interactions/application/update/InteractionUpdater.js';
import { InteractionDeleter } from '../../src/interactions/application/delete/InteractionDeleter.js';
import { InteractionSearcher } from '../../src/interactions/application/search/InteractionSearcher.js';
import { InteractionCounter } from '../../src/interactions/domain/InteractionCounter.js';
import { InteractionResponse } from '../../src/interactions/application/InteractionResponse.js';
import { KnexInteractionRepository } from '../../src/interactions/infrastructure/persistence/KnexInteractionRepository.js';
import { InteractionBulkMover } from '../../src/interactions/application/bulk-mover/InteractionBulkMover.js';
import { InteractionBulkCloser } from '../../src/interactions/application/bulk-closer/InteractionBulkCloser.js';
import { InteractionBulkDeleter } from '../../src/interactions/application/bulk-deleter/InteractionBulkDeleter.js';
import { InteractionReviewClaimer } from '../../src/interactions/application/review/InteractionReviewClaimer.js';
import { InteractionReviewReleaser } from '../../src/interactions/application/review/InteractionReviewReleaser.js';
import { KnexLiteralRepository } from '../../src/literals/infrastructure/persistence/KnexLiteralRepository.js';
import { QueryDBError } from '../../src/shared/errors/QueryDBError.js';
import { INTERACTION_EMAIL_ALREADY_LINKED } from '@kace/error-codes';
import { InteractionEmailAlreadyLinkedError } from '../../src/interactions/domain/InteractionEmailAlreadyLinkedError.js';
import { Criteria } from '../../src/shared/criteria/Criteria.js';
import InteractionMother from './domain/InteractionMother.js';
import { SYSTEM_INBOX_WORKSPACE_ID } from '../../src/workspaces/domain/SystemInboxWorkspace.js';
import { ensureParentRow } from '../support/ensureParentRow.js';

describe('Interactions Test', () => {
    const repository = new KnexInteractionRepository(knexConfig);

    const user = (id = uuidV4()) => ({ id: { value: id } });
    const reviewUser = (id = uuidV4(), canReleaseAny = false) => ({
        id: { value: id },
        hasPermission: (role, moduleId, permission) =>
            canReleaseAny &&
            role === 'administrador' &&
            moduleId === 'interactions' &&
            permission === 'InteractionsUpdate',
    });

    async function insertWorkspace(id, overrides = {}) {
        await repository.connection('workspaces').insert({
            id,
            description: overrides.description ?? `Workspace ${id}`,
            is_active: overrides.is_active ?? true,
            created_at: overrides.created_at ?? new Date().toISOString(),
            created_by: overrides.created_by ?? uuidV4(),
            updated_at: overrides.updated_at ?? null,
            updated_by: overrides.updated_by ?? null,
            deleted_at: overrides.deleted_at ?? null,
            deleted_by: overrides.deleted_by ?? null,
        });
    }

    async function insertEmailAggregate({ emailId, workspaceId, createdBy = uuidV4() }) {
        const now = new Date().toISOString();
        const bodyId = uuidV4();
        const attachmentId = uuidV4();

        await repository.connection('emails').insert({
            id: emailId,
            s3_key: null,
            subject: 'Bulk consistency email',
            sender: 'sender@example.com',
            to: JSON.stringify([{ name: 'Receiver', email: 'receiver@example.com' }]),
            cc: JSON.stringify([]),
            bcc: JSON.stringify([]),
            priority: 'normal',
            workspace_id: workspaceId,
            message_id: uuidV4(),
            thread_id: uuidV4(),
            account_id: null,
            received_at: now,
            created_at: now,
            created_by: createdBy,
            updated_at: null,
            updated_by: null,
            deleted_at: null,
            deleted_by: null,
        });

        await repository.connection('emails_body').insert({
            id: bodyId,
            email_id: emailId,
            body: 'Plain body',
            body_html: '<p>HTML body</p>',
            created_at: now,
            created_by: createdBy,
            updated_at: null,
            updated_by: null,
            deleted_at: null,
            deleted_by: null,
        });

        await repository.connection('emails_attachments').insert({
            id: attachmentId,
            email_id: emailId,
            url: 'https://example.com/file.pdf',
            size: 2048,
            filename: 'file.pdf',
            created_at: now,
            created_by: createdBy,
            updated_at: null,
            updated_by: null,
            deleted_at: null,
            deleted_by: null,
        });

        return { bodyId, attachmentId };
    }

    async function insertInteractionRow({ interactionId, workspaceId, emailId = null, createdBy = uuidV4() }) {
        const now = new Date().toISOString();

        // Varios tests pasan un workspace_id inventado; postgres exige la fila padre.
        await ensureParentRow(repository.connection, 'workspaces', workspaceId);

        await repository.connection('interactions').insert({
            id: interactionId,
            channel_id: 'email',
            client_identifier: 'customer@example.com',
            external_identifier: uuidV4(),
            description: 'Bulk consistency interaction',
            priority: 'normal',
            workspace_id: workspaceId,
            email_id: emailId,
            start_review_at: null,
            start_review_by: null,
            conversation_id: uuidV4(),
            receipt_at: now,
            closed_at: null,
            closed_by: null,
            closed_observation: null,
            delete_observation: null,
            is_closed: false,
            in_review: false,
            created_at: now,
            created_by: createdBy,
            updated_at: null,
            updated_by: null,
            deleted_at: null,
            deleted_by: null,
        });
    }

    async function insertCloseMotive(optionName) {
        const now = new Date().toISOString();
        const modelId = uuidV4();
        const fieldId = uuidV4();
        const optionId = uuidV4();

        await repository.connection('literales').insert([
            {
                id: modelId,
                tipo_literal: null,
                nombre: 'interactions',
                is_active: true,
                created_at: now,
                created_by: uuidV4(),
                updated_at: null,
                updated_by: null,
                deleted_at: null,
                deleted_by: null,
            },
            {
                id: fieldId,
                tipo_literal: modelId,
                nombre: 'closed_observation',
                is_active: true,
                created_at: now,
                created_by: uuidV4(),
                updated_at: null,
                updated_by: null,
                deleted_at: null,
                deleted_by: null,
            },
            {
                id: optionId,
                tipo_literal: fieldId,
                nombre: optionName,
                is_active: true,
                created_at: now,
                created_by: uuidV4(),
                updated_at: null,
                updated_by: null,
                deleted_at: null,
                deleted_by: null,
            },
        ]);
    }

    it('creates a new Interaction instance', async () => {
        const dto = InteractionMother.dto();
        await InteractionMother.ensureRelations(repository.connection, dto);
        const interactionCreator = new InteractionCreator(repository);

        const createdInteraction = await interactionCreator.execute(dto);

        const result = await repository.connection('interactions').select('*').where('id', dto.id);
        expect(result.length).toBe(1);
        expect(createdInteraction.id.value).toBe(dto.id);
    });

    it('persists migrated closed and review state flags directly through the repository', async () => {
        const closedInteraction = await InteractionMother.createClosedInteraction(repository, {
            is_migrated: true,
        });
        const reviewInteraction = await InteractionMother.createInReviewInteraction(repository, {
            is_migrated: true,
        });

        const closedRow = await repository.connection('interactions').where({ id: closedInteraction.id.value }).first();
        const reviewRow = await repository.connection('interactions').where({ id: reviewInteraction.id.value }).first();

        expect(closedRow.is_migrated).toBeTruthy();
        expect(closedRow.is_closed).toBeTruthy();
        expect(closedRow.in_review).toBeFalsy();
        expect(reviewRow.is_migrated).toBeTruthy();
        expect(reviewRow.is_closed).toBeFalsy();
        expect(reviewRow.in_review).toBeTruthy();
    });

    it('persists omitted state flags as false', async () => {
        const dto = InteractionMother.dto();
        await InteractionMother.ensureRelations(repository.connection, dto);
        delete dto.is_closed;
        delete dto.in_review;

        const interaction = await new InteractionCreator(repository).execute(dto);
        const row = await repository.connection('interactions').where({ id: interaction.id.value }).first();

        expect(row.is_closed).toBeFalsy();
        expect(row.in_review).toBeFalsy();
    });

    it('should throw an error when creating an existing Interaction', async () => {
        const dto = InteractionMother.dto({ channel_id: 'phone' });
        await InteractionMother.ensureRelations(repository.connection, dto);
        const interactionCreator = new InteractionCreator(repository);
        await interactionCreator.execute(dto);

        const duplicateCreator = new InteractionCreator(repository);
        await expect(duplicateCreator.execute(dto)).rejects.toThrow(
            new CustomError(`Interaction with id ${dto.id} already exists`)
        );
    });

    it('should throw a public conflict when creating a second interaction for the same email', async () => {
        const workspaceId = uuidV4();
        const emailId = uuidV4();
        const existingInteractionId = uuidV4();
        await insertWorkspace(workspaceId);
        await insertEmailAggregate({ emailId, workspaceId });
        await insertInteractionRow({ interactionId: existingInteractionId, workspaceId, emailId });

        const dto = InteractionMother.dto({
            workspace_id: workspaceId,
            email_id: emailId,
        });
        const interactionCreator = new InteractionCreator(repository);

        await expect(interactionCreator.execute(dto)).rejects.toMatchObject({
            emailId,
            interactionId: existingInteractionId,
            publicErrorCode: INTERACTION_EMAIL_ALREADY_LINKED,
        });
        await expect(interactionCreator.execute(dto)).rejects.toBeInstanceOf(InteractionEmailAlreadyLinkedError);
    });

    it('finds linked emails from raw and value-object ids and ignores nullish batch entries', async () => {
        const workspaceId = uuidV4();
        const rawEmailId = uuidV4();
        const wrappedEmailId = uuidV4();
        const rawInteractionId = uuidV4();
        const wrappedInteractionId = uuidV4();

        await insertWorkspace(workspaceId);
        await insertEmailAggregate({ emailId: rawEmailId, workspaceId });
        await insertEmailAggregate({ emailId: wrappedEmailId, workspaceId });
        await insertInteractionRow({ interactionId: rawInteractionId, workspaceId, emailId: rawEmailId });
        await insertInteractionRow({ interactionId: wrappedInteractionId, workspaceId, emailId: wrappedEmailId });

        expect((await repository.findByEmailId(rawEmailId)).id.value).toBe(rawInteractionId);
        expect((await repository.findByEmailId({ value: wrappedEmailId })).id.value).toBe(wrappedInteractionId);

        const batch = await repository.findByEmailIds([null, { value: rawEmailId }, undefined, wrappedEmailId]);
        expect(new Set(batch.map((interaction) => interaction.id.value))).toEqual(
            new Set([rawInteractionId, wrappedInteractionId])
        );
    });

    it('should not create a new Interaction instance when null dto', async () => {
        const interactionCreator = new InteractionCreator(repository);

        await expect(interactionCreator.execute(null)).rejects.toThrow(Error);
    });

    it('finds an existing Interaction instance by id', async () => {
        const dto = InteractionMother.inReviewDto({ channel_id: 'chat' });
        await InteractionMother.ensureRelations(repository.connection, dto);
        const interactionCreator = new InteractionCreator(repository);
        await interactionCreator.execute(dto);

        const interactionFinder = new InteractionFinder(repository);
        const interaction = await interactionFinder.execute(dto.id);

        expect(interaction).not.toBeNull();
        expect(interaction).toBeInstanceOf(InteractionResponse);
    });

    it('return null if not found a record', async () => {
        const interactionFinder = new InteractionFinder(repository);

        await expect(interactionFinder.execute(uuidV4())).rejects.toThrow(CustomError);
    });

    it('updates an existing Interaction instance', async () => {
        const userId = uuidV4();
        const dto = InteractionMother.dto({ priority: 'low' });
        await InteractionMother.ensureRelations(repository.connection, dto);
        const interactionCreator = new InteractionCreator(repository);
        await interactionCreator.execute(dto);

        const dtoUpdate = {
            description: 'Updated interaction description',
            priority: 'high',
            is_closed: true,
            updated_at: new Date().toISOString(),
            updated_by: uuidV4(),
            closed_by: uuidV4(),
            closed_at: new Date().toISOString(),
        };

        const interactionUpdater = new InteractionUpdater(repository);
        await interactionUpdater.execute(dtoUpdate, dto.id, userId);

        const result = await repository.find({ value: dto.id });
        expect(result).toBeInstanceOf(Interaction);
        expect(result.description.value).toEqual(dtoUpdate.description);
        expect(result.priority.value).toEqual(dtoUpdate.priority);
        expect(Boolean(result.is_closed.value)).toBe(dtoUpdate.is_closed);
        expect(result.updated_at.value).toEqual(dtoUpdate.updated_at);
        expect(result.updated_by.value).toEqual(dtoUpdate.updated_by);
    });

    it('ignores review lock fields in the generic Interaction updater', async () => {
        const userId = uuidV4();
        const spoofedReviewerId = uuidV4();
        const spoofedReviewDate = new Date('2026-05-27T10:00:00.000Z').toISOString();
        const dto = InteractionMother.dto({
            workspace_id: uuidV4(),
            in_review: false,
            start_review_at: null,
            start_review_by: null,
        });
        await InteractionMother.ensureRelations(repository.connection, dto);
        const interactionCreator = new InteractionCreator(repository);
        await interactionCreator.execute(dto);

        await new InteractionUpdater(repository).execute(
            {
                description: 'Updated without claiming review',
                in_review: true,
                start_review_at: spoofedReviewDate,
                start_review_by: spoofedReviewerId,
            },
            dto.id,
            userId
        );

        const result = await repository.find({ value: dto.id });
        expect(result.description.value).toBe('Updated without claiming review');
        expect(Boolean(result.in_review.value)).toBe(false);
        expect(result.start_review_at.value).toBeNull();
        expect(result.start_review_by.value).toBeNull();
    });

    it('should return an error when update a non-existent Interaction instance', async () => {
        const interactionUpdater = new InteractionUpdater(repository);

        await expect(interactionUpdater.execute({ is_closed: true }, uuidV4())).rejects.toThrow(CustomError);
    });

    it('deletes an existing Interaction instance by id', async () => {
        const dto = InteractionMother.closedDto();
        await InteractionMother.ensureRelations(repository.connection, dto);
        const interactionCreator = new InteractionCreator(repository);
        await interactionCreator.execute(dto);

        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidV4(),
        };

        const interactionDeleter = new InteractionDeleter(repository);
        await interactionDeleter.execute(dto.id, deleteDto);

        const result = await repository.find({ value: dto.id });
        expect(result).toBeNull();
    });

    it('should return an error when delete a non-existent Interaction instance', async () => {
        const interactionDeleter = new InteractionDeleter(repository);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidV4(),
        };

        await expect(interactionDeleter.execute(uuidV4(), deleteDto)).rejects.toThrow(CustomError);
    });

    it('searches for Interaction instances with given criteria', async () => {
        const interactionCreator = new InteractionCreator(repository);
        for (let i = 0; i < 10; i++) {
            const dto = InteractionMother.dto({
                channel_id: i % 2 === 0 ? 'email' : 'phone',
                priority: i % 3 === 0 ? 'high' : 'normal',
                in_review: i % 2 === 0,
            });
            await InteractionMother.ensureRelations(repository.connection, dto);
            await interactionCreator.execute(dto);
        }

        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const interactionSearcher = new InteractionSearcher(repository);
        const interactionResult = await interactionSearcher.execute(dtoCriteria);

        expect(interactionResult).toBeInstanceOf(InteractionCollectionResponse);
    });

    it('applies the singular relationship contract to both search rows and count', async () => {
        const matchingWorkspaceId = uuidV4();
        const otherWorkspaceId = uuidV4();
        const matchingDescription = `relationship-search-${uuidV4()}`;

        await insertWorkspace(matchingWorkspaceId, { description: matchingDescription });
        await insertWorkspace(otherWorkspaceId, { description: 'Other relationship workspace' });
        await InteractionMother.createInteraction(repository, { workspace_id: matchingWorkspaceId });
        await InteractionMother.createInteraction(repository, { workspace_id: otherWorkspaceId });

        const result = await new InteractionSearcher(repository).execute({
            filter: [
                {
                    field: 'workspaces.description',
                    operator: 'eq',
                    value: matchingDescription,
                    type: 'AND',
                },
            ],
            relationship: [
                {
                    table: 'workspaces',
                    condition: {
                        column: 'workspaces.id',
                        refColumn: 'interactions.workspace_id',
                    },
                    type: 'join',
                },
            ],
            limit: 10,
            offset: 0,
            order: undefined,
        });
        const json = result.toJson();

        expect(json.data.items).toHaveLength(1);
        expect(json.data.items[0].workspace_id).toBe(matchingWorkspaceId);
        expect(json.metadata.count).toBe(1);
    });

    it('keeps Admin search rows and count aligned while filtering only by workspace activity', async () => {
        const marker = `admin-search-${uuidV4()}`;
        const activeWorkspaceId = uuidV4();
        const inactiveWorkspaceId = uuidV4();
        const nullActivityWorkspaceId = uuidV4();
        const softDeletedWorkspaceId = uuidV4();
        const interactionIds = {
            active: uuidV4(),
            inactive: uuidV4(),
            nullActivity: uuidV4(),
            legacyNullWorkspace: uuidV4(),
            systemInbox: uuidV4(),
            softDeletedWorkspace: uuidV4(),
            softDeletedInteraction: uuidV4(),
        };

        await insertWorkspace(activeWorkspaceId);
        await insertWorkspace(inactiveWorkspaceId, { is_active: false });
        await repository.connection('workspaces').insert({
            id: nullActivityWorkspaceId,
            description: 'Workspace with null activity',
            is_active: null,
        });
        await insertWorkspace(softDeletedWorkspaceId, {
            is_active: true,
            deleted_at: new Date().toISOString(),
            deleted_by: uuidV4(),
        });
        await ensureParentRow(repository.connection, 'workspaces', SYSTEM_INBOX_WORKSPACE_ID, { is_active: true });
        await repository.connection('workspaces').where({ id: SYSTEM_INBOX_WORKSPACE_ID }).update({ is_active: true });

        const fixtures = [
            [interactionIds.active, activeWorkspaceId],
            [interactionIds.inactive, inactiveWorkspaceId],
            [interactionIds.nullActivity, nullActivityWorkspaceId],
            [interactionIds.legacyNullWorkspace, activeWorkspaceId],
            [interactionIds.systemInbox, SYSTEM_INBOX_WORKSPACE_ID],
            [interactionIds.softDeletedWorkspace, softDeletedWorkspaceId],
            [interactionIds.softDeletedInteraction, activeWorkspaceId],
        ];
        for (const [id, workspaceId] of fixtures) {
            await InteractionMother.createInteraction(repository, {
                id,
                workspace_id: workspaceId,
                description: marker,
            });
        }
        await repository.connection('interactions').where({ id: interactionIds.legacyNullWorkspace }).update({
            workspace_id: null,
        });
        await repository.connection('interactions').where({ id: interactionIds.softDeletedInteraction }).update({
            deleted_at: new Date().toISOString(),
            deleted_by: uuidV4(),
        });

        const result = await new InteractionSearcher(repository).executeForAdminSearch({
            filter: [
                { field: 'description', operator: 'eq', value: marker, type: 'AND' },
                { field: 'deleted_at', operator: 'null', value: '', type: 'AND' },
            ],
            relationship: undefined,
            limit: 2,
            offset: 0,
            order: { field: 'id', direction: 'asc' },
        });
        const json = result.toJson();
        const eligibleIds = [
            interactionIds.active,
            interactionIds.legacyNullWorkspace,
            interactionIds.systemInbox,
            interactionIds.softDeletedWorkspace,
        ].sort();

        expect(json.data.items.map(({ id }) => id)).toEqual(eligibleIds.slice(0, 2));
        expect(json.metadata.count).toBe(eligibleIds.length);
        expect(json.metadata.count).toBeGreaterThan(json.data.items.length);
    });

    it('orders by derived status (open < in review < closed) without failing on the virtual column', async () => {
        await InteractionMother.createInteraction(repository, { description: 'closed one', is_closed: true });
        await InteractionMother.createInteraction(repository, { description: 'open one' });
        await InteractionMother.createInteraction(repository, { description: 'review one', in_review: true });

        const toStatuses = (result) =>
            result
                .toJson()
                .data.items.map((item) => (item.is_closed ? 'closed' : item.in_review ? 'inReview' : 'open'));

        const searcher = new InteractionSearcher(repository);

        const ascResult = await searcher.execute({
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'status', direction: 'asc' },
        });
        expect(toStatuses(ascResult)).toEqual(['open', 'inReview', 'closed']);

        const descResult = await searcher.execute({
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'status', direction: 'desc' },
        });
        expect(toStatuses(descResult)).toEqual(['closed', 'inReview', 'open']);

        // The derived `status` entry must also be extracted from an array order so
        // it never reaches Criteria as an invalid `ORDER BY status` column.
        const arrayOrderResult = await searcher.execute({
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: [{ field: 'status', direction: 'asc' }],
        });
        expect(toStatuses(arrayOrderResult)).toEqual(['open', 'inReview', 'closed']);
    });

    it('should return an error when not exist field is filtered', async () => {
        const interactionCreator = new InteractionCreator(repository);
        for (let i = 0; i < 10; i++) {
            const dto = InteractionMother.inReviewDto({
                description: `Interaction ${i}`,
            });
            await InteractionMother.ensureRelations(repository.connection, dto);
            await interactionCreator.execute(dto);
        }

        const dtoCriteria = {
            filter: [
                {
                    field: 'not_exist',
                    operator: 'eq',
                    value: 'value',
                    type: 'AND',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        await expect(new InteractionSearcher(repository).execute(dtoCriteria)).rejects.toThrow(QueryDBError);
    });

    it('counts the total number of Interaction instances', async () => {
        const interactionCreator = new InteractionCreator(repository);
        for (let i = 0; i < 10; i++) {
            const dto = InteractionMother.inReviewDto({
                description: `Interaction ${i}`,
                receipt_at: new Date().toISOString(),
            });
            await InteractionMother.ensureRelations(repository.connection, dto);
            await interactionCreator.execute(dto);
        }

        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const interactionCounter = new InteractionCounter(repository);
        const interactionResult = await interactionCounter.execute(dtoCriteria);

        expect(Number(interactionResult.count)).toBe(10);
    });

    it('should return a zero for not found criteria', async () => {
        const interactionCreator = new InteractionCreator(repository);
        for (let i = 0; i < 10; i++) {
            const dto = InteractionMother.inReviewDto({
                channel_id: 'chat',
                description: `Interaction ${i}`,
                receipt_at: new Date().toISOString(),
            });
            await InteractionMother.ensureRelations(repository.connection, dto);
            await interactionCreator.execute(dto);
        }

        const dtoCriteria = {
            filter: [
                {
                    field: 'channel_id',
                    operator: 'eq',
                    value: 'nonexistent_channel',
                    type: 'AND',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const interactionCounter = new InteractionCounter(repository);
        const interactionResult = await interactionCounter.execute(dtoCriteria);

        expect(Number(interactionResult.count)).toBe(0);
    });

    it('should filter interactions by channel_id', async () => {
        const interactionCreator = new InteractionCreator(repository);
        for (let i = 0; i < 5; i++) {
            const dto = InteractionMother.emailDto();
            await InteractionMother.ensureRelations(repository.connection, dto);
            await interactionCreator.execute(dto);
        }
        for (let i = 0; i < 3; i++) {
            const dto = InteractionMother.smsDto();
            await InteractionMother.ensureRelations(repository.connection, dto);
            await interactionCreator.execute(dto);
        }

        const dtoCriteria = {
            filter: [
                {
                    field: 'channel_id',
                    operator: 'eq',
                    value: 'email',
                    type: 'AND',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const interactionSearcher = new InteractionSearcher(repository);
        const result = await interactionSearcher.execute(dtoCriteria);

        expect(result).toBeInstanceOf(InteractionCollectionResponse);
        expect(result.toJson().data.items.length).toBe(5);
    });

    it('should filter interactions by priority', async () => {
        const interactionCreator = new InteractionCreator(repository);
        for (let i = 0; i < 4; i++) {
            const dto = InteractionMother.highPriorityDto();
            await InteractionMother.ensureRelations(repository.connection, dto);
            await interactionCreator.execute(dto);
        }
        for (let i = 0; i < 6; i++) {
            const dto = InteractionMother.dto({ priority: 'low' });
            await InteractionMother.ensureRelations(repository.connection, dto);
            await interactionCreator.execute(dto);
        }

        const dtoCriteria = {
            filter: [
                {
                    field: 'priority',
                    operator: 'eq',
                    value: 'high',
                    type: 'AND',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const interactionSearcher = new InteractionSearcher(repository);
        const result = await interactionSearcher.execute(dtoCriteria);

        expect(result).toBeInstanceOf(InteractionCollectionResponse);
        expect(result.toJson().data.items.length).toBe(4);
    });

    it('should handle pagination correctly', async () => {
        const interactionCreator = new InteractionCreator(repository);
        for (let i = 0; i < 15; i++) {
            const dto = InteractionMother.dto({
                description: `Interaction ${i}`,
            });
            await InteractionMother.ensureRelations(repository.connection, dto);
            await interactionCreator.execute(dto);
        }

        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 5,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const interactionSearcher = new InteractionSearcher(repository);
        const result = await interactionSearcher.execute(dtoCriteria);

        expect(result).toBeInstanceOf(InteractionCollectionResponse);
        expect(result.toJson().data.items.length).toBe(5);
    });

    describe('bulk email consistency', () => {
        it('lists only tenant-wide eligible Agent move destinations with minimal fields', async () => {
            const currentWorkspaceId = uuidV4();
            const otherGroupWorkspaceId = uuidV4();
            const zeroGroupWorkspaceId = uuidV4();
            const inactiveWorkspaceId = uuidV4();
            const deletedWorkspaceId = uuidV4();
            await insertWorkspace(currentWorkspaceId, { description: 'Current' });
            await insertWorkspace(otherGroupWorkspaceId, { description: 'Other group' });
            await insertWorkspace(zeroGroupWorkspaceId, { description: 'Zero group' });
            await insertWorkspace(inactiveWorkspaceId, { description: 'Inactive', is_active: false });
            await insertWorkspace(deletedWorkspaceId, {
                description: 'Deleted',
                deleted_at: new Date().toISOString(),
                deleted_by: uuidV4(),
            });

            const destinations = await repository.findEligibleAgentMoveDestinations(currentWorkspaceId);

            expect(destinations).toEqual([
                { id: otherGroupWorkspaceId, description: 'Other group' },
                { id: zeroGroupWorkspaceId, description: 'Zero group' },
            ]);
        });

        it('validates Agent move destinations without requiring an active-group relation', async () => {
            const eligibleWorkspaceId = uuidV4();
            const inactiveWorkspaceId = uuidV4();
            const deletedAtWorkspaceId = uuidV4();
            const deletedByWorkspaceId = uuidV4();
            await insertWorkspace(eligibleWorkspaceId);
            await insertWorkspace(inactiveWorkspaceId, { is_active: false });
            await insertWorkspace(deletedAtWorkspaceId, { deleted_at: new Date().toISOString() });
            await insertWorkspace(deletedByWorkspaceId, { deleted_by: uuidV4() });

            await expect(repository.findEligibleAgentMoveDestinationById(eligibleWorkspaceId)).resolves.toMatchObject({
                id: eligibleWorkspaceId,
            });
            for (const ineligibleId of [
                inactiveWorkspaceId,
                deletedAtWorkspaceId,
                deletedByWorkspaceId,
                SYSTEM_INBOX_WORKSPACE_ID,
                uuidV4(),
            ]) {
                await expect(repository.findEligibleAgentMoveDestinationById(ineligibleId)).resolves.toBeNull();
            }
        });

        it('makes a cross-group moved interaction unreadable from the Agent source scope', async () => {
            const actorId = uuidV4();
            const activeGroupId = uuidV4();
            const sourceWorkspaceId = uuidV4();
            const destinationWorkspaceId = uuidV4();
            const interactionId = uuidV4();
            const scope = { userId: actorId, activeGroupId };
            // El grupo va primero: `usuarios.grupo_activo` lo referencia y postgres
            // valida la FK en el momento del insert.
            await repository.connection('grupos').insert({ id: activeGroupId, status: 1 });
            await repository.connection('usuarios').insert({ id: actorId, grupo_activo: activeGroupId });
            await repository.connection('rel_usuarios_grupos').insert({
                usuario_id: actorId,
                grupo_id: activeGroupId,
            });
            await insertWorkspace(sourceWorkspaceId);
            await insertWorkspace(destinationWorkspaceId);
            await repository.connection('workspaces_grupos_relations').insert({
                workspace_id: sourceWorkspaceId,
                grupo_id: activeGroupId,
            });
            await insertInteractionRow({ interactionId, workspaceId: sourceWorkspaceId, emailId: null });

            await expect(repository.findByIdForActiveGroup(interactionId, scope)).resolves.toMatchObject({
                id: interactionId,
            });
            await new InteractionBulkMover(repository, user(actorId)).execute(
                { interaction_ids: [interactionId], workspace_id: destinationWorkspaceId },
                scope
            );

            await expect(repository.findByIdForActiveGroup(interactionId, scope)).resolves.toBeNull();
        });

        it('updates linked email workspace when moving interactions in bulk', async () => {
            const originWorkspaceId = uuidV4();
            const destinationWorkspaceId = uuidV4();
            const interactionId = uuidV4();
            const emailId = uuidV4();
            const actorId = uuidV4();

            await insertWorkspace(originWorkspaceId);
            await insertWorkspace(destinationWorkspaceId);
            await insertEmailAggregate({ emailId, workspaceId: originWorkspaceId, createdBy: actorId });
            await insertInteractionRow({ interactionId, workspaceId: originWorkspaceId, emailId, createdBy: actorId });

            await new InteractionBulkMover(repository, user(actorId)).execute({
                interaction_ids: [interactionId],
                workspace_id: destinationWorkspaceId,
            });

            const interaction = await repository.connection('interactions').where({ id: interactionId }).first();
            const email = await repository.connection('emails').where({ id: emailId }).first();

            expect(interaction.workspace_id).toBe(destinationWorkspaceId);
            expect(email.workspace_id).toBe(destinationWorkspaceId);
            expect(email.updated_by).toBe(actorId);
            expect(email.updated_at).toBeTruthy();
        });

        it('soft-deletes linked email aggregate when deleting interactions in bulk', async () => {
            const workspaceId = uuidV4();
            const interactionId = uuidV4();
            const emailId = uuidV4();
            const actorId = uuidV4();
            const motive = 'Duplicado';

            await insertWorkspace(workspaceId);
            await insertCloseMotive(motive);
            await insertEmailAggregate({ emailId, workspaceId, createdBy: actorId });
            await insertInteractionRow({ interactionId, workspaceId, emailId, createdBy: actorId });

            await new InteractionBulkDeleter(
                repository,
                new KnexLiteralRepository(repository.connection),
                user(actorId)
            ).execute({
                interaction_ids: [interactionId],
                motive,
            });

            const interaction = await repository.connection('interactions').where({ id: interactionId }).first();
            const email = await repository.connection('emails').where({ id: emailId }).first();
            const body = await repository.connection('emails_body').where({ email_id: emailId }).first();
            const attachment = await repository.connection('emails_attachments').where({ email_id: emailId }).first();

            expect(interaction.deleted_by).toBe(actorId);
            expect(interaction.deleted_at).toBeTruthy();
            expect(email.deleted_by).toBe(actorId);
            expect(email.deleted_at).toBeTruthy();
            expect(body.deleted_by).toBe(actorId);
            expect(body.deleted_at).toBeTruthy();
            expect(attachment.deleted_by).toBe(actorId);
            expect(attachment.deleted_at).toBeTruthy();
        });

        it('does not change linked email rows when closing interactions in bulk', async () => {
            const workspaceId = uuidV4();
            const interactionId = uuidV4();
            const emailId = uuidV4();
            const actorId = uuidV4();
            const motive = 'Cliente no responde';

            await insertWorkspace(workspaceId);
            await insertCloseMotive(motive);
            await insertEmailAggregate({ emailId, workspaceId, createdBy: actorId });
            await insertInteractionRow({ interactionId, workspaceId, emailId, createdBy: actorId });

            const emailBeforeClose = await repository.connection('emails').where({ id: emailId }).first();
            const bodyBeforeClose = await repository.connection('emails_body').where({ email_id: emailId }).first();
            const attachmentBeforeClose = await repository
                .connection('emails_attachments')
                .where({ email_id: emailId })
                .first();

            await new InteractionBulkCloser(
                repository,
                new KnexLiteralRepository(repository.connection),
                user(actorId)
            ).execute({
                interaction_ids: [interactionId],
                motive,
            });

            const interaction = await repository.connection('interactions').where({ id: interactionId }).first();
            const emailAfterClose = await repository.connection('emails').where({ id: emailId }).first();
            const bodyAfterClose = await repository.connection('emails_body').where({ email_id: emailId }).first();
            const attachmentAfterClose = await repository
                .connection('emails_attachments')
                .where({ email_id: emailId })
                .first();

            expect(interaction.is_closed).toBe(true);
            expect(emailAfterClose).toEqual(emailBeforeClose);
            expect(bodyAfterClose).toEqual(bodyBeforeClose);
            expect(attachmentAfterClose).toEqual(attachmentBeforeClose);
        });

        it('moves and deletes interactions without linked email ids', async () => {
            const originWorkspaceId = uuidV4();
            const destinationWorkspaceId = uuidV4();
            const moveInteractionId = uuidV4();
            const deleteInteractionId = uuidV4();
            const actorId = uuidV4();
            const motive = 'Duplicado sin email';

            await insertWorkspace(originWorkspaceId);
            await insertWorkspace(destinationWorkspaceId);
            await insertCloseMotive(motive);
            await insertInteractionRow({
                interactionId: moveInteractionId,
                workspaceId: originWorkspaceId,
                emailId: null,
            });
            await insertInteractionRow({
                interactionId: deleteInteractionId,
                workspaceId: originWorkspaceId,
                emailId: null,
            });

            await new InteractionBulkMover(repository, user(actorId)).execute({
                interaction_ids: [moveInteractionId],
                workspace_id: destinationWorkspaceId,
            });
            await new InteractionBulkDeleter(
                repository,
                new KnexLiteralRepository(repository.connection),
                user(actorId)
            ).execute({
                interaction_ids: [deleteInteractionId],
                motive,
            });

            const movedInteraction = await repository
                .connection('interactions')
                .where({ id: moveInteractionId })
                .first();
            const deletedInteraction = await repository
                .connection('interactions')
                .where({ id: deleteInteractionId })
                .first();

            expect(movedInteraction.workspace_id).toBe(destinationWorkspaceId);
            expect(deletedInteraction.deleted_by).toBe(actorId);
            expect(deletedInteraction.deleted_at).toBeTruthy();
        });
    });

    describe('workspace + search combined filter uses AND (not OR leak)', () => {
        const SEARCH_TERM = 'unicorn-search-term';

        it('preserves workspace-less interactions while excluding one workspace identifier', async () => {
            const excludedWorkspaceId = 'dbcc5b5a-61bb-4b5a-95d0-9f6222749e54';
            const excludedInteractionId = uuidV4();
            const workspaceLessInteractionId = uuidV4();
            const visibleInteractionId = uuidV4();

            await insertInteractionRow({
                interactionId: excludedInteractionId,
                workspaceId: excludedWorkspaceId,
            });
            await insertInteractionRow({
                interactionId: workspaceLessInteractionId,
                workspaceId: null,
            });
            await insertInteractionRow({
                interactionId: visibleInteractionId,
                workspaceId: uuidV4(),
            });

            const criteria = new Criteria(
                [
                    {
                        groupType: 'AND',
                        filters: [
                            {
                                field: 'workspace_id',
                                operator: 'neq',
                                value: excludedWorkspaceId,
                                type: 'AND',
                            },
                            {
                                field: 'workspace_id',
                                operator: 'null',
                                value: 'null',
                                type: 'OR',
                            },
                        ],
                    },
                ],
                undefined,
                50,
                0,
                { field: 'created_at', direction: 'asc' },
                'interactions'
            );
            const rows = await criteria.convertToKnex(repository.connection('interactions').select('*'));
            const interactionIds = rows.map(({ id }) => id);

            expect(interactionIds).toEqual(expect.arrayContaining([workspaceLessInteractionId, visibleInteractionId]));
            expect(interactionIds).not.toContain(excludedInteractionId);
        });

        it('returns only ws-1 matches when workspace filter AND search group are combined', async () => {
            // `workspaces.id` es varchar(36): un uuid con prefijo no cabe.
            const ws1 = uuidV4();
            const ws2 = uuidV4();

            // ws-1: one interaction that matches the search term, one that does not
            await InteractionMother.createInteraction(repository, {
                workspace_id: ws1,
                description: `contains ${SEARCH_TERM} here`,
                client_identifier: `no-match-client-ws1-${uuidV4()}`,
            });
            await InteractionMother.createInteraction(repository, {
                workspace_id: ws1,
                description: 'unrelated description ws1',
                client_identifier: `no-match-client-ws1b-${uuidV4()}`,
            });

            // ws-2: one interaction that also matches the search term (must NOT appear in results)
            await InteractionMother.createInteraction(repository, {
                workspace_id: ws2,
                description: `also contains ${SEARCH_TERM} here`,
                client_identifier: `no-match-client-ws2-${uuidV4()}`,
            });
            // ws-2: one matching via client_identifier
            await InteractionMother.createInteraction(repository, {
                workspace_id: ws2,
                description: 'unrelated description ws2',
                client_identifier: `${SEARCH_TERM}-client-ws2`,
            });

            const searcher = new InteractionSearcher(repository);

            // Filter: workspace_id = ws1 AND (description LIKE term OR client_identifier LIKE term)
            // The groupType logic under test is what matters here, and it is identical for LIKE
            // and for the ILIKE the production query maps to on Postgres.
            const withWorkspaceFilter = {
                filter: [
                    { field: 'workspace_id', operator: 'eq', value: ws1, type: 'AND' },
                    {
                        groupType: 'AND',
                        filters: [
                            { field: 'description', operator: 'like', value: SEARCH_TERM, type: 'OR' },
                            { field: 'client_identifier', operator: 'like', value: SEARCH_TERM, type: 'OR' },
                        ],
                    },
                ],
                relationship: undefined,
                limit: 50,
                offset: 0,
                order: { field: 'created_at', direction: 'asc' },
            };

            const result = await searcher.execute(withWorkspaceFilter);
            const items = result.toJson().data.items;

            // Only the ws-1 match should be returned — ws-2 matches must be excluded
            expect(items.length).toBe(1);
            expect(items.every((item) => item.workspace_id === ws1)).toBe(true);

            // Contrast: same search group WITHOUT workspace filter returns matches from BOTH workspaces
            const searchOnlyFilter = {
                filter: [
                    {
                        groupType: 'AND',
                        filters: [
                            { field: 'description', operator: 'like', value: SEARCH_TERM, type: 'OR' },
                            { field: 'client_identifier', operator: 'like', value: SEARCH_TERM, type: 'OR' },
                        ],
                    },
                ],
                relationship: undefined,
                limit: 50,
                offset: 0,
                order: { field: 'created_at', direction: 'asc' },
            };

            const searchOnlyResult = await searcher.execute(searchOnlyFilter);
            const searchOnlyItems = searchOnlyResult.toJson().data.items;

            // Must see results from both workspaces, confirming the OR group works and isolation comes from AND
            const workspacesFound = new Set(searchOnlyItems.map((item) => item.workspace_id));
            expect(workspacesFound.has(ws1)).toBe(true);
            expect(workspacesFound.has(ws2)).toBe(true);
        });
    });

    describe('interaction review persistence', () => {
        it('claims and releases review fields with history rows', async () => {
            const workspace = { id: { value: uuidV4() } };
            const currentUser = reviewUser();

            await insertWorkspace(workspace.id.value);
            const interaction = await InteractionMother.createInteraction(repository, {
                workspace_id: workspace.id.value,
                in_review: false,
                start_review_at: null,
                start_review_by: null,
            });

            await new InteractionReviewClaimer(repository, currentUser).execute(interaction.id.value);

            const claimedRow = await repository.connection('interactions').where({ id: interaction.id.value }).first();
            expect(Boolean(claimedRow.in_review)).toBe(true);
            expect(claimedRow.start_review_by).toBe(currentUser.id.value);
            expect(claimedRow.start_review_at).not.toBeNull();

            await new InteractionReviewReleaser(repository, currentUser).execute(interaction.id.value);

            const releasedRow = await repository.connection('interactions').where({ id: interaction.id.value }).first();
            expect(Boolean(releasedRow.in_review)).toBe(false);
            expect(releasedRow.start_review_by).toBeNull();
            expect(releasedRow.start_review_at).toBeNull();

            // `knex.raw` sobre postgres devuelve el `Result` de pg, no un array de
            // filas, y `changed_attributes` es jsonb: llega ya deserializado.
            const historyRows = await repository.connection.raw(
                'select * from history_interactions where entity_id = ? order by created_at asc',
                [interaction.id.value]
            );
            const [claimHistory, releaseHistory] = historyRows.rows.slice(-2);

            expect(claimHistory.changed_attributes).toEqual(
                expect.objectContaining({
                    in_review: true,
                    start_review_by: currentUser.id.value,
                    updated_by: currentUser.id.value,
                })
            );
            expect(claimHistory.changed_attributes.start_review_at).not.toBeNull();
            expect(releaseHistory.changed_attributes).toEqual(
                expect.objectContaining({
                    in_review: false,
                    start_review_at: null,
                    start_review_by: null,
                    updated_by: currentUser.id.value,
                })
            );
        });

        it('keeps the first review claim and rejects the second claimant', async () => {
            const workspace = { id: { value: uuidV4() } };
            const firstUser = reviewUser();
            const secondUser = reviewUser();

            await insertWorkspace(workspace.id.value);
            const interaction = await InteractionMother.createInteraction(repository, {
                workspace_id: workspace.id.value,
                in_review: false,
                start_review_at: null,
                start_review_by: null,
            });

            await new InteractionReviewClaimer(repository, firstUser).execute(interaction.id.value);

            await expect(
                new InteractionReviewClaimer(repository, secondUser).execute(interaction.id.value)
            ).rejects.toMatchObject({
                statusCode: 409,
            });

            const row = await repository.connection('interactions').where({ id: interaction.id.value }).first();
            expect(row.start_review_by).toBe(firstUser.id.value);
        });
    });
});
