import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../../../knexfile.js';
import { KnexCaseRepository } from '../../../../src/cases';
import { ensureParentRow } from '../../../support/ensureParentRow.js';

describe('KnexCaseRepository — first_view_at', () => {
    const repository = new KnexCaseRepository(knexConfig);

    const insertCase = async (overrides = {}) => {
        const row = {
            id: uuidv4(),
            responsable_id: uuidv4(),
            first_view_at: null,
            created_by: uuidv4(),
            created_at: new Date().toISOString(),
            deleted_at: null,
            deleted_by: null,
            ...overrides,
        };
        await ensureParentRow(repository.connection, 'usuarios', row.responsable_id);
        await repository.connection('cases').insert(row);
        return row;
    };

    const readFirstViewAt = async (id) => {
        const stored = await repository.connection('cases').first('first_view_at', 'responsable_id').where({ id });
        return stored;
    };

    describe('markFirstViewByResponsible', () => {
        it('sets first_view_at when the user is the responsible and it was null', async () => {
            const row = await insertCase();
            const when = new Date();

            const applied = await repository.markFirstViewByResponsible({
                caseId: row.id,
                userId: row.responsable_id,
                when,
            });

            expect(applied).toBe(when);
            const stored = await readFirstViewAt(row.id);
            expect(stored.first_view_at).not.toBeNull();
        });

        it('is idempotent and does not overwrite an existing first_view_at', async () => {
            const existing = new Date('2026-01-01T00:00:00.000Z').toISOString();
            const row = await insertCase({ first_view_at: existing });

            const applied = await repository.markFirstViewByResponsible({
                caseId: row.id,
                userId: row.responsable_id,
                when: new Date(),
            });

            expect(applied).toBeNull();
            const stored = await readFirstViewAt(row.id);
            expect(new Date(stored.first_view_at).toISOString()).toBe(existing);
        });

        it('does nothing when the user is not the current responsible', async () => {
            const row = await insertCase();

            const applied = await repository.markFirstViewByResponsible({
                caseId: row.id,
                userId: uuidv4(),
                when: new Date(),
            });

            expect(applied).toBeNull();
            const stored = await readFirstViewAt(row.id);
            expect(stored.first_view_at).toBeNull();
        });

        it('does nothing for a soft-deleted case', async () => {
            const row = await insertCase({ deleted_at: new Date().toISOString() });

            const applied = await repository.markFirstViewByResponsible({
                caseId: row.id,
                userId: row.responsable_id,
                when: new Date(),
            });

            expect(applied).toBeNull();
        });
    });

    describe('bulkAssign reset', () => {
        it('resets first_view_at only on cases whose current responsible differs from the new one', async () => {
            const newResponsible = uuidv4();
            const newGroup = uuidv4();
            const fv = new Date('2026-02-02T00:00:00.000Z').toISOString();
            const caseDiff = await insertCase({ responsable_id: uuidv4(), first_view_at: fv });
            const caseSame = await insertCase({ responsable_id: newResponsible, first_view_at: fv });

            // `bulkAssign` escribe `grupo_id`, que es clave foranea contra
            // `grupos`: el id se inventa aqui, asi que hay que respaldarlo.
            await ensureParentRow(repository.connection, 'grupos', newGroup);

            await repository.bulkAssign([caseDiff.id, caseSame.id], {
                responsable_id: newResponsible,
                grupo_id: newGroup,
                updated_at: new Date().toISOString(),
                updated_by: uuidv4(),
            });

            const diff = await readFirstViewAt(caseDiff.id);
            const same = await readFirstViewAt(caseSame.id);

            expect(diff.responsable_id).toBe(newResponsible);
            expect(diff.first_view_at).toBeNull();

            expect(same.responsable_id).toBe(newResponsible);
            expect(new Date(same.first_view_at).toISOString()).toBe(fv);
        });

        it('does not touch first_view_at when no responsible is provided (group-only reassignment)', async () => {
            const fv = new Date('2026-03-03T00:00:00.000Z').toISOString();
            const kase = await insertCase({ first_view_at: fv });
            const newGroup = uuidv4();

            await ensureParentRow(repository.connection, 'grupos', newGroup);

            await repository.bulkAssign([kase.id], {
                grupo_id: newGroup,
                updated_at: new Date().toISOString(),
                updated_by: uuidv4(),
            });

            const stored = await readFirstViewAt(kase.id);
            expect(new Date(stored.first_view_at).toISOString()).toBe(fv);
        });
    });
});
