import { knexConfig } from '../../knexfile.js';
import { KnexCaseRepository } from '../../../src/cases/infrastructure/persistence/KnexCaseRepository.js';
import CasesMother from './CasesMother.js';

describe('CasesMother respalda la cadena ANS que exige el repositorio', () => {
    const repository = new KnexCaseRepository(knexConfig);

    it('deja la clasificacion del caso apuntando a un ANS real', async () => {
        const kase = await CasesMother.createCase(repository);

        const [row] = await repository
            .connection('clasificaciones')
            .join('ans', 'clasificaciones.ans_id', 'ans.id')
            .where('clasificaciones.id', kase.clasificacion_id.value)
            .select('ans.id as ans_id', 'ans.medicion_ans_id as medicion_ans_id');

        expect(row).toBeDefined();
        expect(row.ans_id).not.toBeNull();
        expect(row.medicion_ans_id).not.toBeNull();
    });

    it('deja el grupo del caso apuntando a un horario real', async () => {
        const kase = await CasesMother.createCase(repository);

        const [row] = await repository
            .connection('grupos')
            .join('shift_management', 'grupos.horario_id', 'shift_management.id')
            .where('grupos.id', kase.grupo_id.value)
            .select('shift_management.id as shift_id', 'shift_management.work_days as work_days');

        expect(row).toBeDefined();
        expect(row.shift_id).not.toBeNull();
        expect(row.work_days).not.toBeNull();
    });
});
