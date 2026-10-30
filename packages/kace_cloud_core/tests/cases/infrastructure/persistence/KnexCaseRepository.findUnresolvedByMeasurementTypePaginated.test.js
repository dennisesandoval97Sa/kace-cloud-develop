import { KnexCaseRepository } from '../../../../src/cases/index.js';
import { KnexAnsRepository, Types } from '../../../../src/ans/index.js';
import { KnexClassificationRepository } from '../../../../src/classifications/index.js';
import { KnexGroupsRepository } from '../../../../src/grupos/index.js';
import { KnexShiftManagementRepository } from '../../../../src/shift-management/index.js';
import { knexConfig } from '../../../knexfile.js';
import CasesMother from '../../../cases/domain/CasesMother.js';
import AnsMother from '../../../ans/domain/AnsMother.js';
import ClassificationsMother from '../../../classifications/domain/ClassificationsMother.js';
import { GroupsMother } from '../../../grupos/domain/GroupsMother.js';
import ShiftManagementMother from '../../../shift-management/domain/ShiftManagementMother.js';

describe('KnexCaseRepository.findUnresolvedByMeasurementTypePaginated', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const ansRepository = new KnexAnsRepository(repository.connection);
    const classificationRepository = new KnexClassificationRepository(repository.connection);
    const groupsRepository = new KnexGroupsRepository(repository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(repository.connection);

    const seedScenario = async ({ countByType }) => {
        const ids = [];
        const shift = await ShiftManagementMother.createShiftManagement(shiftManagementRepository, {});
        const group = await GroupsMother.createWithCustomShiftManagement(groupsRepository, shift);

        for (const [type, count] of Object.entries(countByType)) {
            const ans = await AnsMother.createAns(ansRepository, { medicion_ans_id: type });
            const classification = await ClassificationsMother.create(classificationRepository, {
                ans_id: ans.id.value,
            });
            for (let i = 0; i < count; i++) {
                const kase = await CasesMother.createCase(repository, {
                    clasificacion_id: classification.id.value,
                    grupo_id: group.id.value,
                    fecha_resolucion: null,
                });
                ids.push({ id: kase.id.value, type });
            }
        }
        return ids;
    };

    it('returns empty array when no cases match', async () => {
        const chunk = await repository.findUnresolvedByMeasurementTypePaginated({
            measurementType: Types.DAYS.value,
            afterId: null,
            limit: 100,
        });
        expect(chunk).toEqual([]);
    });

    it('returns at most `limit` rows ordered by id ascending', async () => {
        await seedScenario({ countByType: { [Types.DAYS.value]: 5 } });

        const chunk = await repository.findUnresolvedByMeasurementTypePaginated({
            measurementType: Types.DAYS.value,
            afterId: null,
            limit: 3,
        });

        expect(chunk.length).toBe(3);
        const ids = chunk.map((r) => r.kase.id.value);
        const sorted = [...ids].sort();
        expect(ids).toEqual(sorted);
    });

    it('respects the afterId cursor (keyset pagination)', async () => {
        const seeded = await seedScenario({ countByType: { [Types.DAYS.value]: 5 } });
        const sortedIds = seeded.map((s) => s.id).sort();
        const cursor = sortedIds[1]; // skip first two

        const chunk = await repository.findUnresolvedByMeasurementTypePaginated({
            measurementType: Types.DAYS.value,
            afterId: cursor,
            limit: 10,
        });

        expect(chunk.length).toBe(3);
        chunk.forEach((row) => {
            expect(row.kase.id.value > cursor).toBe(true);
        });
    });

    it('recovers all rows exactly once when iterated to exhaustion', async () => {
        const seeded = await seedScenario({ countByType: { [Types.DAYS.value]: 25 } });
        const limit = 7;
        const recovered = [];
        let cursor = null;
        while (true) {
            const chunk = await repository.findUnresolvedByMeasurementTypePaginated({
                measurementType: Types.DAYS.value,
                afterId: cursor,
                limit,
            });
            if (chunk.length === 0) break;
            recovered.push(...chunk.map((r) => r.kase.id.value));
            cursor = chunk[chunk.length - 1].kase.id.value;
        }
        expect(new Set(recovered).size).toBe(seeded.length);
        expect(recovered.sort()).toEqual(seeded.map((s) => s.id).sort());
    });

    it('excludes soft-deleted and resolved cases', async () => {
        const seeded = await seedScenario({ countByType: { [Types.DAYS.value]: 3 } });
        const sortedIds = seeded.map((s) => s.id).sort();
        await repository.connection('cases').where('id', sortedIds[0]).update({ deleted_at: new Date() });
        await repository.connection('cases').where('id', sortedIds[1]).update({ fecha_resolucion: new Date() });

        const chunk = await repository.findUnresolvedByMeasurementTypePaginated({
            measurementType: Types.DAYS.value,
            afterId: null,
            limit: 100,
        });

        expect(chunk.length).toBe(1);
        expect(chunk[0].kase.id.value).toBe(sortedIds[2]);
    });
});
