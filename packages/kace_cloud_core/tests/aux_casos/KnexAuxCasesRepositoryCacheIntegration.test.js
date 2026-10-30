import { KnexAuxCasesRepository } from '../../src/aux_casos/infrastructure/persitance/KnexAuxCasesRepository.js';
import { EntityCache } from '../../src/shared';
import { knexConfig } from '../knexfile.js';
import { AuxCasesMother } from './domain/AuxCasesMother.js';
import { v4 as uuidv4 } from 'uuid';

describe('KnexAuxCasesRepository cache', () => {
    const repository = new KnexAuxCasesRepository(knexConfig);

    beforeEach(() => {
        EntityCache.clear();
    });

    it('returns the same cached instance on second findByCaseId', async () => {
        const caseId = { value: '00000000-0000-0000-0000-000000000050' };

        const first = await repository.findByCaseId(caseId);
        const second = await repository.findByCaseId(caseId);

        expect(second).toBe(first);
    });

    it('skipCache bypasses the stale cached value and reads the current row', async () => {
        const caseId = uuidv4();
        await AuxCasesMother.createAuxCase(repository, {
            caso_id: caseId,
            data: { formulario_aux_felipe: { nombre: 'Felipe', apellido: 'Original' } },
        });

        const cached = await repository.findByCaseId({ value: caseId });
        expect(cached.data.value.formulario_aux_felipe.apellido).toBe('Original');

        // Simulates a write from a different process: this process's cache is never invalidated.
        await repository
            .table()
            .where({ caso_id: caseId })
            .update({
                data: JSON.stringify({ formulario_aux_felipe: { nombre: 'Felipe', apellido: 'Updated elsewhere' } }),
            });

        const stillCached = await repository.findByCaseId({ value: caseId });
        expect(stillCached.data.value.formulario_aux_felipe.apellido).toBe('Original');

        const fresh = await repository.findByCaseId({ value: caseId }, { skipCache: true });
        expect(fresh.data.value.formulario_aux_felipe.apellido).toBe('Updated elsewhere');
    });
});
