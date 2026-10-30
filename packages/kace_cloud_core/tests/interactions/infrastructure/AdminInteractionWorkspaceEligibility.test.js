import { randomUUID } from 'node:crypto';
import { Criteria } from '../../../src/shared/criteria/Criteria.js';
import { KnexInteractionRepository } from '../../../src/interactions/infrastructure/persistence/KnexInteractionRepository.js';
import { knexConfig } from '../../knexfile.js';
import InteractionMother from '../domain/InteractionMother.js';

const interactionRow = ({ workspaceId, label, ...overrides }) => ({
    id: randomUUID(),
    channel_id: 'email',
    client_identifier: randomUUID(),
    external_identifier: label,
    description: 'admin-workspace-eligibility',
    priority: 'normal',
    workspace_id: workspaceId,
    email_id: null,
    start_review_at: null,
    start_review_by: null,
    conversation_id: randomUUID(),
    receipt_at: null,
    closed_at: null,
    closed_by: null,
    is_closed: false,
    in_review: false,
    is_migrated: false,
    closed_observation: null,
    delete_observation: null,
    created_by: randomUUID(),
    created_at: new Date().toISOString(),
    updated_by: null,
    updated_at: null,
    deleted_by: null,
    deleted_at: null,
    ...overrides,
});

const interactionCriteria = (marker, order = undefined) =>
    new Criteria(
        [
            {
                field: 'description',
                operator: 'eq',
                value: marker,
                type: 'AND',
            },
        ],
        undefined,
        order ? 10 : 0,
        0,
        order,
        'interactions'
    );

const numericCount = (count) => Number(count.count ?? count['count(*)']);

const workspaceRow = ({ id, isActive }) => ({
    id,
    description: `Workspace ${id}`,
    is_active: isActive,
    created_at: new Date().toISOString(),
    created_by: randomUUID(),
    updated_at: null,
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
});

describe('Admin interaction workspace eligibility query', () => {
    const repository = new KnexInteractionRepository(knexConfig);

    it('excludes inactive, null-activity, and orphan references from both rows and count', async () => {
        const marker = `admin-workspace-eligibility-${randomUUID()}`;
        const workspaceIds = {
            active: randomUUID(),
            inactive: randomUUID(),
            nullActivity: randomUUID(),
            orphan: randomUUID(),
        };
        await repository
            .connection('workspaces')
            .insert([
                workspaceRow({ id: workspaceIds.active, isActive: true }),
                workspaceRow({ id: workspaceIds.inactive, isActive: false }),
                workspaceRow({ id: workspaceIds.nullActivity, isActive: null }),
            ]);
        await repository.connection('interactions').insert([
            interactionRow({ workspaceId: workspaceIds.active, label: 'active', description: marker }),
            interactionRow({ workspaceId: workspaceIds.inactive, label: 'inactive', description: marker }),
            interactionRow({
                workspaceId: workspaceIds.nullActivity,
                label: 'null-activity',
                description: marker,
            }),
            interactionRow({ workspaceId: null, label: 'legacy-null', description: marker }),
        ]);
        await repository.connection.transaction(async (trx) => {
            // Production constraints prevent new orphans. Disable trigger checks
            // only inside this disposable test transaction to cover legacy data.
            await trx.raw('set local session_replication_role = replica');
            await trx('interactions').insert(
                interactionRow({ workspaceId: workspaceIds.orphan, label: 'orphan', description: marker })
            );
        });

        const rows = await repository.searchForAdminActiveWorkspaces(
            interactionCriteria(marker, { field: 'external_identifier', direction: 'asc' })
        );
        const count = await repository.countForAdminActiveWorkspaces(interactionCriteria(marker));

        expect(rows.map((interaction) => interaction.external_identifier.value)).toEqual(['active', 'legacy-null']);
        expect(numericCount(count)).toBe(2);
    });

    it('excludes every half-deleted interaction from ordinary and Admin rows and counts', async () => {
        const marker = `admin-workspace-eligibility-${randomUUID()}`;
        const activeWorkspaceId = randomUUID();
        await repository.connection('workspaces').insert(workspaceRow({ id: activeWorkspaceId, isActive: true }));
        await repository.connection('interactions').insert([
            interactionRow({ workspaceId: activeWorkspaceId, label: 'live', description: marker }),
            interactionRow({
                workspaceId: activeWorkspaceId,
                label: 'deleted-at-only',
                description: marker,
                deleted_at: new Date().toISOString(),
            }),
            interactionRow({
                workspaceId: activeWorkspaceId,
                label: 'deleted-by-only',
                description: marker,
                deleted_by: randomUUID(),
            }),
            interactionRow({
                workspaceId: activeWorkspaceId,
                label: 'fully-deleted',
                description: marker,
                deleted_at: new Date().toISOString(),
                deleted_by: randomUUID(),
            }),
        ]);

        const ordinaryRows = await repository.search(
            interactionCriteria(marker, { field: 'external_identifier', direction: 'asc' })
        );
        const ordinaryCount = await repository.count(interactionCriteria(marker));
        const adminRows = await repository.searchForAdminActiveWorkspaces(
            interactionCriteria(marker, { field: 'external_identifier', direction: 'asc' })
        );
        const adminCount = await repository.countForAdminActiveWorkspaces(interactionCriteria(marker));

        expect(ordinaryRows.map((interaction) => interaction.external_identifier.value)).toEqual(['live']);
        expect(numericCount(ordinaryCount)).toBe(1);
        expect(adminRows.map((interaction) => interaction.external_identifier.value)).toEqual(['live']);
        expect(numericCount(adminCount)).toBe(1);
    });

    it('reconstitutes legacy null-workspace rows through persisted Interaction reads', async () => {
        const marker = `admin-workspace-eligibility-${randomUUID()}`;
        const emailId = randomUUID();
        const legacyInteraction = await InteractionMother.createInteraction(repository, {
            description: marker,
            external_identifier: 'legacy-null',
            email_id: emailId,
        });
        const legacyId = legacyInteraction.id.value;
        await repository.connection('interactions').where({ id: legacyId }).update({ workspace_id: null });

        const byId = await repository.find({ value: legacyId });
        const byEmailId = await repository.findByEmailId(emailId);
        const byEmailIds = await repository.findByEmailIds([emailId]);
        const ordinaryRows = await repository.search(interactionCriteria(marker));
        const adminRows = await repository.searchForAdminActiveWorkspaces(interactionCriteria(marker));
        const byEmailIdsMatch = byEmailIds.find((interaction) => interaction.id.value === legacyId);
        const ordinaryMatch = ordinaryRows.find((interaction) => interaction.id.value === legacyId);
        const adminMatch = adminRows.find((interaction) => interaction.id.value === legacyId);

        expect(byId.workspace_id.value).toBeNull();
        expect(byEmailId.workspace_id.value).toBeNull();
        expect(byEmailIdsMatch.workspace_id.value).toBeNull();
        expect(ordinaryMatch.workspace_id.value).toBeNull();
        expect(adminMatch.workspace_id.value).toBeNull();
    });
});
