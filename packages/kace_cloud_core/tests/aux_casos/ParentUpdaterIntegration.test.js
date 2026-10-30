import { v4 as uuidv4 } from 'uuid';
import { KnexAuxCasesRepository } from '../../src/aux_casos/index.js';
import ParentUpdater from '../../src/cases/application/update/ParentUpdater.js';
import { knexConfig } from '../knexfile.js';
import { AuxCasesMother } from './domain/AuxCasesMother';

describe('ParentUpdater - sub-case data into parent', () => {
    const auxCaseRepository = new KnexAuxCasesRepository(knexConfig);

    const taskNames = ['tarea_preventiva', 'tarea_en_sitio', 'tarea_retiro_sitio', 'tarea_finalizacion'];

    const buildChild = (taskKey) => ({
        caso_id: uuidv4(),
        data: {
            info_parent_case: { numero_expediente: '2000315512222097' },
            [taskKey]: { nombre_tm: taskKey, fecha_hora_vencimiento: '2026-06-01T15:49:47.000Z' },
        },
    });

    it('preserves every sibling sub-case key on the parent when children are processed concurrently', async () => {
        const parentCaseId = uuidv4();
        await AuxCasesMother.createAuxCase(auxCaseRepository, { caso_id: parentCaseId, data: {} });

        const children = await Promise.all(
            taskNames.map((taskKey) => AuxCasesMother.createAuxCase(auxCaseRepository, buildChild(taskKey)))
        );

        const parentUpdater = new ParentUpdater(auxCaseRepository);
        await Promise.all(children.map((child) => parentUpdater.execute(child.caso_id.value, parentCaseId)));

        const parent = await auxCaseRepository.findByCaseId({ value: parentCaseId });

        // The lost-update bug dropped some tarea_* keys; all must survive now.
        for (const taskKey of taskNames) {
            expect(parent.data.value[taskKey]).toBeDefined();
            expect(parent.data.value[taskKey].nombre_tm).toEqual(taskKey);
        }
    });

    it('does nothing when the child aux case has no data', async () => {
        const parentCaseId = uuidv4();
        await AuxCasesMother.createAuxCase(auxCaseRepository, { caso_id: parentCaseId, data: { existing: 'keep' } });
        const childCaseId = uuidv4();
        await AuxCasesMother.createAuxCase(auxCaseRepository, { caso_id: childCaseId, data: {} });

        const parentUpdater = new ParentUpdater(auxCaseRepository);
        await parentUpdater.execute(childCaseId, parentCaseId);

        const parent = await auxCaseRepository.findByCaseId({ value: parentCaseId });
        expect(parent.data.value.existing).toEqual('keep');
    });
});
