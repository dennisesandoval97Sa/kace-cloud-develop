import { AnsCasesCounter } from '../../../../src/shared/domain/services/AnsCasesCounter.js';
import { knexConfig } from '../../../knexfile.js';
import CasesMother from '../../../cases/domain/CasesMother.js';
import { v4 as uuidv4 } from 'uuid';
import { KnexCaseRepository } from '../../../../src/cases/index.js';

describe('AnsCasesCounterService', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const service = new AnsCasesCounter(repository);

    it('should count cases correctly by group ID', async () => {
        const grupo_id = uuidv4();
        await CasesMother.createCase(repository, CasesMother.dto({ ans_posicion: 1, grupo_id }));
        await CasesMother.createCase(repository, CasesMother.dto({ ans_posicion: 2, grupo_id }));
        await CasesMother.createCase(repository, CasesMother.dto({ ans_posicion: 3, grupo_id }));

        const counts = await service.execute('group', grupo_id);

        expect(Number(counts.expired.count)).toBe(1);
        expect(Number(counts.intermediate.count)).toBe(1);
        expect(Number(counts.notExpired.count)).toBe(1);
    });

    it('should count cases correctly by responsible ID', async () => {
        const responsable_id = uuidv4();
        await CasesMother.createCase(repository, CasesMother.dto({ ans_posicion: 1, responsable_id }));
        await CasesMother.createCase(repository, CasesMother.dto({ ans_posicion: 2, responsable_id }));
        await CasesMother.createCase(repository, CasesMother.dto({ ans_posicion: 3, responsable_id }));

        const counts = await service.execute('responsible', responsable_id);

        expect(Number(counts.expired.count)).toBe(1);
        expect(Number(counts.intermediate.count)).toBe(1);
        expect(Number(counts.notExpired.count)).toBe(1);
    });

    it('should throw an error for invalid type', async () => {
        const id = uuidv4();
        await expect(service.execute('invalidType', id)).rejects.toThrow(Error);
    });
});
