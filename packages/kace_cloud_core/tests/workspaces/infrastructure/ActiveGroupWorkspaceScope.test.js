import { KnexWorkspacesRepository } from '../../../src/workspaces/infrastructure/persistence/KnexWorkspacesRepository.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const ID = {
    user: '11111111-1111-4111-8111-111111111111',
    group: '22222222-2222-4222-8222-222222222222',
    otherGroup: '33333333-3333-4333-8333-333333333333',
    sameGroupWorkspace: '44444444-4444-4444-8444-444444444444',
    otherGroupWorkspace: '55555555-5555-4555-8555-555555555555',
    unassignedWorkspace: '66666666-6666-4666-8666-666666666666',
    inactiveWorkspace: '77777777-7777-4777-8777-777777777777',
    deletedWorkspace: '88888888-8888-4888-8888-888888888888',
};

// usuarios/rel_usuarios_grupos/grupos/workspaces_grupos_relations/workspaces all exist in
// the real migrated schema (see tests/knexfile.js — every test file gets its own cloned
// postgres database). The per-file database is shared across every `it()` in this file (a
// fresh KnexWorkspacesRepository is built in beforeEach, but it points at the same clone), so
// the fixed IDs below must be cleared before reseeding each test (children before parents).
const cleanupSchema = async (knex) => {
    await knex('workspaces_grupos_relations')
        .whereIn('workspace_id', Object.values(ID))
        .orWhereIn('grupo_id', Object.values(ID))
        .delete();
    await knex('workspaces').whereIn('id', Object.values(ID)).delete();
    await knex('rel_usuarios_grupos')
        .whereIn('usuario_id', Object.values(ID))
        .orWhereIn('grupo_id', Object.values(ID))
        .delete();
    await knex('usuarios').whereIn('id', Object.values(ID)).delete();
    await knex('grupos').whereIn('id', Object.values(ID)).delete();
};

const workspaceRow = (id, overrides = {}) => ({
    id,
    description: `workspace-${id}`,
    is_active: true,
    created_by: ID.user,
    created_at: '2026-01-01T00:00:00.000Z',
    tag: `tag-${id}`,
    rules: null,
    deleted_at: null,
    deleted_by: null,
    ...overrides,
});

describe('KnexWorkspacesRepository active-group workspace scope', () => {
    let repository;

    beforeEach(async () => {
        repository = new KnexWorkspacesRepository(makeWriterConfig(), makeReaderConfig());
        await cleanupSchema(repository.writer);
    });

    afterEach(async () => {
        if (repository) await repository.destroyConnection();
    });

    const seedUserAndGroups = async ({
        activeGroup = ID.group,
        includeMembership = true,
        groupStatus = 1,
        groupDeletedAt = null,
        groupDeletedBy = null,
    } = {}) => {
        // grupos before usuarios: usuarios.grupo_activo is FK-constrained to grupos.id.
        await repository.writer('grupos').insert([
            { id: ID.group, status: groupStatus, deleted_at: groupDeletedAt, deleted_by: groupDeletedBy },
            { id: ID.otherGroup, status: 1, deleted_at: null, deleted_by: null },
        ]);
        await repository.writer('usuarios').insert({ id: ID.user, grupo_activo: activeGroup });
        if (includeMembership) {
            await repository.writer('rel_usuarios_grupos').insert({ usuario_id: ID.user, grupo_id: ID.group });
        }
    };

    const search = (overrides = {}) =>
        repository.searchAvailableForActiveGroup({
            userId: ID.user,
            activeGroupId: ID.group,
            ...overrides,
        });

    it('returns only active workspaces related to the valid active group', async () => {
        await seedUserAndGroups();
        await repository
            .writer('workspaces')
            .insert([workspaceRow(ID.sameGroupWorkspace), workspaceRow(ID.otherGroupWorkspace)]);
        await repository.writer('workspaces_grupos_relations').insert([
            { workspace_id: ID.sameGroupWorkspace, grupo_id: ID.group },
            { workspace_id: ID.otherGroupWorkspace, grupo_id: ID.otherGroup },
        ]);

        const result = await search();

        expect(result.map((workspace) => workspace.id.value)).toEqual([ID.sameGroupWorkspace]);
    });

    it('excludes workspaces with no group relation', async () => {
        await seedUserAndGroups();
        await repository.writer('workspaces').insert(workspaceRow(ID.unassignedWorkspace));

        await expect(search()).resolves.toEqual([]);
    });

    it('excludes inactive and deleted workspaces', async () => {
        await seedUserAndGroups();
        await repository.writer('workspaces').insert([
            workspaceRow(ID.inactiveWorkspace, { is_active: false }),
            workspaceRow(ID.deletedWorkspace, {
                deleted_at: new Date().toISOString(),
                deleted_by: ID.user,
            }),
        ]);
        await repository.writer('workspaces_grupos_relations').insert([
            { workspace_id: ID.inactiveWorkspace, grupo_id: ID.group },
            { workspace_id: ID.deletedWorkspace, grupo_id: ID.group },
        ]);

        await expect(search()).resolves.toEqual([]);
    });

    it('excludes a workspace marked deleted by an actor even if its deletion timestamp is missing', async () => {
        await seedUserAndGroups();
        await repository.writer('workspaces').insert(workspaceRow(ID.deletedWorkspace, { deleted_by: ID.user }));
        await repository
            .writer('workspaces_grupos_relations')
            .insert({ workspace_id: ID.deletedWorkspace, grupo_id: ID.group });

        await expect(search()).resolves.toEqual([]);
    });

    it('returns no workspaces when membership is missing', async () => {
        await seedUserAndGroups({ includeMembership: false });
        await repository.writer('workspaces').insert(workspaceRow(ID.sameGroupWorkspace));
        await repository
            .writer('workspaces_grupos_relations')
            .insert({ workspace_id: ID.sameGroupWorkspace, grupo_id: ID.group });

        await expect(search()).resolves.toEqual([]);
    });

    it.each([
        ['inactive', { groupStatus: 2 }],
        ['deleted', { groupDeletedAt: new Date().toISOString() }],
        ['deleted by an actor', { groupDeletedBy: ID.user }],
    ])('returns no workspaces when the active group is %s', async (_label, groupOverrides) => {
        await seedUserAndGroups(groupOverrides);
        await repository.writer('workspaces').insert(workspaceRow(ID.sameGroupWorkspace));
        await repository
            .writer('workspaces_grupos_relations')
            .insert({ workspace_id: ID.sameGroupWorkspace, grupo_id: ID.group });

        await expect(search()).resolves.toEqual([]);
    });

    it('returns no workspaces when the requested group differs from usuarios.grupo_activo', async () => {
        await seedUserAndGroups({ activeGroup: ID.otherGroup });
        await repository.writer('workspaces').insert(workspaceRow(ID.sameGroupWorkspace));
        await repository
            .writer('workspaces_grupos_relations')
            .insert({ workspace_id: ID.sameGroupWorkspace, grupo_id: ID.group });

        await expect(search()).resolves.toEqual([]);
    });

    it.each([
        ['user id', { userId: null }],
        ['active group id', { activeGroupId: null }],
    ])('returns no workspaces when %s is missing', async (_label, missingScope) => {
        await seedUserAndGroups();
        await repository.writer('workspaces').insert(workspaceRow(ID.sameGroupWorkspace));
        await repository
            .writer('workspaces_grupos_relations')
            .insert({ workspace_id: ID.sameGroupWorkspace, grupo_id: ID.group });

        await expect(search(missingScope)).resolves.toEqual([]);
    });

    // Writer and reader configs are two routes to the SAME physical database (see
    // tests/knexfile.js), so a populated-writer/empty-reader data check can no longer prove
    // which pool served the read. searchAvailableForActiveGroup() uses `this.table()`
    // (KnexWorkspacesRepository.js), never `this.read`/`this.reader` — that guarantee is now
    // enforced by the source code, not observable data; this keeps the real end-to-end call
    // (proving the query still executes correctly with a reader configured) plus the pool
    // identity check.
    it('reads the available-workspace scope from the writer when a reader is configured', async () => {
        await seedUserAndGroups();
        await repository.writer('workspaces').insert(workspaceRow(ID.sameGroupWorkspace));
        await repository
            .writer('workspaces_grupos_relations')
            .insert({ workspace_id: ID.sameGroupWorkspace, grupo_id: ID.group });

        const result = await search();

        expect(repository.reader).not.toBe(repository.writer);
        expect(result.map((workspace) => workspace.id.value)).toEqual([ID.sameGroupWorkspace]);
    });
});
