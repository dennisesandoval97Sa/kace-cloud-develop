import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../../../knexfile.js';
import { CaseFinder, KnexCaseRepository } from '../../../../src/cases';
import CasesMother from '../../../cases/domain/CasesMother';

describe('CaseFinder — first_view_at tracking', () => {
    const repository = new KnexCaseRepository(knexConfig);

    const userWithId = (id) => ({ id: { value: id } });

    const readFirstViewAt = async (id) => {
        const row = await repository.connection('cases').first('first_view_at').where({ id });
        return row?.first_view_at ?? null;
    };

    describe('execute()', () => {
        it('sets first_view_at when the responsible opens the case', async () => {
            const kase = await CasesMother.createCaseWithRelations(repository);
            const responsableId = kase.responsable_id.value;

            const response = await new CaseFinder(repository, userWithId(responsableId)).execute(kase.id.value);

            expect(response.toJson().data.first_view_at).not.toBeNull();
            expect(await readFirstViewAt(kase.id.value)).not.toBeNull();
        });

        it('does not set first_view_at when a non-responsible opens the case', async () => {
            const kase = await CasesMother.createCaseWithRelations(repository);

            const response = await new CaseFinder(repository, userWithId(uuidv4())).execute(kase.id.value);

            expect(response.toJson().data.first_view_at).toBeNull();
            expect(await readFirstViewAt(kase.id.value)).toBeNull();
        });

        it('is idempotent: keeps the original first_view_at on subsequent views', async () => {
            const existing = new Date('2026-01-01T00:00:00.000Z').toISOString();
            const kase = await CasesMother.createCaseWithRelations(repository, { first_view_at: existing });
            const responsableId = kase.responsable_id.value;

            const response = await new CaseFinder(repository, userWithId(responsableId)).execute(kase.id.value);

            expect(new Date(response.toJson().data.first_view_at).toISOString()).toBe(existing);
        });
    });

    describe('executeWithAllRelations()', () => {
        it('sets first_view_at when the responsible opens the case detail', async () => {
            const kase = await CasesMother.createCaseWithRelations(repository);
            const responsableId = kase.responsable_id.value;

            const response = await new CaseFinder(repository, userWithId(responsableId)).executeWithAllRelations(
                kase.id.value
            );

            expect(response.toJson().data.first_view_at).not.toBeNull();
            expect(await readFirstViewAt(kase.id.value)).not.toBeNull();
        });

        it('does not set first_view_at when logEvent is false', async () => {
            const kase = await CasesMother.createCaseWithRelations(repository);
            const responsableId = kase.responsable_id.value;

            await new CaseFinder(repository, userWithId(responsableId)).executeWithAllRelations(kase.id.value, false);

            expect(await readFirstViewAt(kase.id.value)).toBeNull();
        });
    });
});
