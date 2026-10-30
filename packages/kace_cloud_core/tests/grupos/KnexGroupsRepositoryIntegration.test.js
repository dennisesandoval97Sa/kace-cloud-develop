import { KnexGroupsRepository } from '../../src/grupos/index.js';
import { Groups } from '../../src/grupos/domain/Groups.js';
import { GroupsMother } from './domain/GroupsMother.js';
import { KnexShiftManagementRepository } from '../../src/shift-management/index.js';
import { knexConfig } from '../knexfile.js';

describe('KnexGroupsRepository (integration)', () => {
    const repository = new KnexGroupsRepository(knexConfig);
    const repositoryShiftManagement = new KnexShiftManagementRepository(repository.connection);

    describe('findAllActive', () => {
        it('returns only groups with status = 1 and deleted_at IS NULL', async () => {
            const active = await GroupsMother.createGroup(repository, repositoryShiftManagement, { status: 1 });
            const disabled = await GroupsMother.createGroup(repository, repositoryShiftManagement, { status: 2 });
            const softDeleted = await GroupsMother.createGroup(repository, repositoryShiftManagement, { status: 1 });

            await repository
                .connection('grupos')
                .where({ id: softDeleted.id.value })
                .update({ deleted_at: new Date().toISOString(), deleted_by: '00000000-0000-0000-0000-000000000000' });

            const result = await repository.findAllActive();

            const ids = result.map((g) => g.id.value);
            expect(ids).toContain(active.id.value);
            expect(ids).not.toContain(disabled.id.value);
            expect(ids).not.toContain(softDeleted.id.value);
            expect(result.every((g) => g instanceof Groups)).toBe(true);
        });

        it('returns empty array when no active groups exist', async () => {
            // La semilla del tenant y el `it` anterior dejan grupos activos en
            // la misma base, asi que la precondicion del test hay que
            // construirla y deshacerla despues.
            const activeIds = await repository
                .connection('grupos')
                .where('status', 1)
                .whereNull('deleted_at')
                .pluck('id');
            await repository.connection('grupos').whereIn('id', activeIds).update({ status: 2 });

            let result;
            try {
                result = await repository.findAllActive();
            } finally {
                await repository.connection('grupos').whereIn('id', activeIds).update({ status: 1 });
            }

            expect(result).toEqual([]);
        });
    });
});
