import { knexConfig } from '../knexfile.js';
import { KnexCaseRepository } from '../../src/cases';
import { CaseCloner } from '../../src/cases/application/clone/CaseCloner.js';
import { KnexGroupsRepository } from '../../src/grupos';
import { KnexShiftManagementRepository } from '../../src/shift-management';
import { KnexClientRepository } from '../../src/clients';
import { KnexUsersRepository } from '../../src/users';
import { KnexClassificationRepository } from '../../src/classifications';
import CasesMother from './domain/CasesMother';
import ClientMother from '../clients/domain/ClientMother';
import UsersMother from '../users/domain/UsersMother';
import ClassificationsMother from '../classifications/domain/ClassificationsMother';
import { GroupsMother } from '../grupos/domain/GroupsMother';
import { KnexFlowRepository } from '../../src/flow';
import { KnexTransitionsRepository } from '../../src/transition';
import { KnexStateRepository } from '../../src/state';
import FlowsMother from '../flow/domain/FlowsMother';
import { TransitionsMother } from '../transition/domain/TransitionsMother';
import { StateMother } from '../state/domain/StateMother';
import { v4 as uuidv4 } from 'uuid';
import { jest } from '@jest/globals';
import { KnexAuxCasesRepository } from '../../src/aux_casos';
import { AuxCasesMother } from '../aux_casos/domain/AuxCasesMother';
import { AuxDefinitionDataStructureFinder } from '../../src/aux_definitions/application/find/AuxDefinitionDataStructureFinder.js';
import { KnexAuxDefinitionsRepository } from '../../src/aux_definitions/infrastructure/persitance/KnexAuxDefinitionsRepository.js';
import { KnexSchemasRepository } from '../../src/schemas/infrastructure/persistence/KnexSchemasRepository.js';
import { checkUniqueFields } from '../../src/shared/domain/services/checkUniqueFields.js';
import { CommentCreator, KnexCommentsRepository } from '../../src/comments';

const clonerId = uuidv4();

const dataStructureFinderFor = (connection) =>
    new AuxDefinitionDataStructureFinder(
        new KnexAuxDefinitionsRepository(connection),
        new KnexSchemasRepository(connection)
    );

describe('CaseCloner — assignment_change_type', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const flowRepo = new KnexFlowRepository(repository.connection);
    const stateRepo = new KnexStateRepository(repository.connection);
    const transitionRepo = new KnexTransitionsRepository(repository.connection);
    const groupsRepository = new KnexGroupsRepository(repository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(repository.connection);
    const clientRepository = new KnexClientRepository(repository.connection);
    const usersRepository = new KnexUsersRepository(repository.connection);
    const classificationRepository = new KnexClassificationRepository(repository.connection);
    const auxCasesRepository = new KnexAuxCasesRepository(repository.connection);
    const dataStructureFinder = dataStructureFinderFor(repository.connection);

    it('tags the cloned case assignment_change_type=creation', async () => {
        const A = await StateMother.createState(stateRepo);
        const B = await StateMother.createState(stateRepo);
        const flow = await FlowsMother.createFlow(flowRepo);
        const T1 = await TransitionsMother.createTransition(transitionRepo, A, flow, B);
        const client = await ClientMother.createClient(clientRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        const original = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: T1.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
            assignment_change_type: 'manual',
        });

        const newId = uuidv4();
        const cloner = new CaseCloner(repository, auxCasesRepository, dataStructureFinder);
        await cloner.execute(original.id.value, { id: newId }, clonerId);

        const row = await repository.connection('cases').first('*').where({ id: newId });
        expect(row).toBeDefined();
        expect(row.assignment_change_type).toBe('creation');
    });
});

describe('CaseCloner — aux_cases', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const auxCasesRepository = new KnexAuxCasesRepository(repository.connection);
    const dataStructureFinder = dataStructureFinderFor(repository.connection);

    it('clones the aux_cases data of the original case', async () => {
        const original = await CasesMother.createCase(repository);
        const originalAux = await AuxCasesMother.createAuxCase(auxCasesRepository, { caso_id: original.id.value });

        const newId = uuidv4();
        await new CaseCloner(repository, auxCasesRepository, dataStructureFinder).execute(
            original.id.value,
            { id: newId },
            clonerId
        );

        const clonedAux = await repository.connection('aux_cases').first('*').where({ caso_id: newId });
        const originalAuxRow = await repository
            .connection('aux_cases')
            .first('*')
            .where({ caso_id: original.id.value });
        expect(clonedAux).toBeDefined();
        expect(clonedAux.id).not.toBe(originalAux.id.value);
        expect(clonedAux.data).toEqual(originalAuxRow.data);
        expect(clonedAux.created_by).toBe(clonerId);
    });

    it('records the user performing the clone as cloned_by', async () => {
        const original = await CasesMother.createCase(repository);

        const newId = uuidv4();
        await new CaseCloner(repository, auxCasesRepository, dataStructureFinder).execute(
            original.id.value,
            { id: newId },
            clonerId
        );

        const clonedCase = await repository.connection('cases').first('*').where({ id: newId });
        expect(clonedCase.cloned_by).toBe(clonerId);
    });

    it('leaves out unique field values so the original aux_cases stays editable', async () => {
        const dataStructure = {
            form: {
                type: 'object',
                data_structure: { document: { type: 'string', unique: true }, note: { type: 'string' } },
            },
        };
        const original = await CasesMother.createCase(repository);
        await AuxCasesMother.createAuxCase(auxCasesRepository, {
            caso_id: original.id.value,
            data: { form: { document: uuidv4(), note: 'keep' } },
        });

        const newId = uuidv4();
        await new CaseCloner(repository, auxCasesRepository, { execute: async () => dataStructure }).execute(
            original.id.value,
            { id: newId },
            clonerId
        );

        const clonedAux = await repository.connection('aux_cases').first('*').where({ caso_id: newId });
        const originalAux = await repository.connection('aux_cases').first('*').where({ caso_id: original.id.value });
        expect(clonedAux.data).toEqual({ form: { note: 'keep' } });
        const violations = await checkUniqueFields(dataStructure, originalAux.data, auxCasesRepository, 'aux_cases', {
            id: originalAux.id,
        });
        expect(violations).toEqual([]);
    });

    it('clones a case without aux_cases', async () => {
        const original = await CasesMother.createCase(repository);

        const newId = uuidv4();
        await new CaseCloner(repository, auxCasesRepository, dataStructureFinder).execute(
            original.id.value,
            { id: newId },
            clonerId
        );

        const clonedCase = await repository.connection('cases').first('*').where({ id: newId });
        const clonedAux = await repository.connection('aux_cases').first('*').where({ caso_id: newId });
        expect(clonedCase).toBeDefined();
        expect(clonedAux).toBeUndefined();
    });

    it('records the cloned aux_cases in its history under the cloned case', async () => {
        const original = await CasesMother.createCase(repository);
        await AuxCasesMother.createAuxCase(auxCasesRepository, { caso_id: original.id.value });

        const newId = uuidv4();
        await new CaseCloner(repository, auxCasesRepository, dataStructureFinder).execute(
            original.id.value,
            { id: newId },
            clonerId
        );

        const history = await repository.connection('history_aux_cases').where({ entity_id: newId });
        expect(history).toHaveLength(1);
    });

    it('leaves the original aux_cases untouched', async () => {
        const original = await CasesMother.createCase(repository);
        await AuxCasesMother.createAuxCase(auxCasesRepository, { caso_id: original.id.value });
        const before = await repository.connection('aux_cases').first('*').where({ caso_id: original.id.value });

        await new CaseCloner(repository, auxCasesRepository, dataStructureFinder).execute(
            original.id.value,
            { id: uuidv4() },
            clonerId
        );

        const after = await repository.connection('aux_cases').first('*').where({ caso_id: original.id.value });
        expect(after).toEqual(before);
    });

    it('clones the current aux_cases data even when a stale copy is cached', async () => {
        const original = await CasesMother.createCase(repository);
        await AuxCasesMother.createAuxCase(auxCasesRepository, { caso_id: original.id.value });
        await auxCasesRepository.findByCaseId(original.id);
        const current = { form: { field: 'changed by another lambda' } };
        await repository.connection('aux_cases').where({ caso_id: original.id.value }).update({ data: current });

        const newId = uuidv4();
        await new CaseCloner(repository, auxCasesRepository, dataStructureFinder).execute(
            original.id.value,
            { id: newId },
            clonerId
        );

        const clonedAux = await repository.connection('aux_cases').first('*').where({ caso_id: newId });
        expect(clonedAux.data).toEqual(current);
    });

    // 1500ms: generous margin so a loaded CI runner can't make the concurrent UPDATE merely
    // slow to start look like it was blocked by the row lock (a false positive for 'holds
    // concurrent updates...' below). The complementary 'does not lock...' test still resolves
    // 'applied' well within this window since nothing blocks it.
    const raceConcurrentAuxUpdate = (casoId, data) => {
        const update = repository
            .connection('aux_cases')
            .where({ caso_id: casoId })
            .update({ data })
            .then(() => 'applied');
        const state = Promise.race([update, new Promise((resolve) => setTimeout(() => resolve('blocked'), 1500))]);
        return { update, state };
    };

    it('holds concurrent updates of the original aux_cases until the clone commits', async () => {
        const original = await CasesMother.createCase(repository);
        const originalData = { form: { field: 'before' } };
        await AuxCasesMother.createAuxCase(auxCasesRepository, { caso_id: original.id.value, data: originalData });
        const saveCase = repository.save.bind(repository);
        let concurrent;
        let stateWhileCloning;
        const saveSpy = jest.spyOn(repository, 'save').mockImplementationOnce(async (...args) => {
            concurrent = raceConcurrentAuxUpdate(original.id.value, { form: { field: 'after' } });
            stateWhileCloning = await concurrent.state;
            return saveCase(...args);
        });

        const newId = uuidv4();
        try {
            await new CaseCloner(repository, auxCasesRepository, dataStructureFinder).execute(
                original.id.value,
                { id: newId },
                clonerId
            );
            await concurrent.update;
        } finally {
            saveSpy.mockRestore();
        }

        expect(stateWhileCloning).toBe('blocked');
        const clonedAux = await repository.connection('aux_cases').first('*').where({ caso_id: newId });
        const originalAux = await repository.connection('aux_cases').first('*').where({ caso_id: original.id.value });
        expect(clonedAux.data).toEqual(originalData);
        expect(originalAux.data).toEqual({ form: { field: 'after' } });
    });

    it('does not lock the original aux_cases while resolving the aux data structure', async () => {
        const original = await CasesMother.createCase(repository);
        await AuxCasesMother.createAuxCase(auxCasesRepository, { caso_id: original.id.value });
        const updatedData = { form: { field: 'updated before the clone' } };
        let stateWhileResolving;
        const updateWhileResolving = {
            execute: async () => {
                stateWhileResolving = await raceConcurrentAuxUpdate(original.id.value, updatedData).state;
                return {};
            },
        };

        const newId = uuidv4();
        await new CaseCloner(repository, auxCasesRepository, updateWhileResolving).execute(
            original.id.value,
            { id: newId },
            clonerId
        );

        expect(stateWhileResolving).toBe('applied');
        const clonedAux = await repository.connection('aux_cases').first('*').where({ caso_id: newId });
        expect(clonedAux.data).toEqual(updatedData);
    });

    it('does not persist the cloned case when the aux_cases write fails', async () => {
        const original = await CasesMother.createCase(repository);
        await AuxCasesMother.createAuxCase(auxCasesRepository, { caso_id: original.id.value });
        const saveSpy = jest.spyOn(auxCasesRepository, 'save').mockRejectedValueOnce(new Error('aux write failed'));

        const newId = uuidv4();
        await expect(
            new CaseCloner(repository, auxCasesRepository, dataStructureFinder).execute(
                original.id.value,
                { id: newId },
                clonerId
            )
        ).rejects.toThrow('aux write failed');

        saveSpy.mockRestore();

        const clonedCase = await repository.connection('cases').first('*').where({ id: newId });
        expect(clonedCase).toBeUndefined();
    });

    it('credits the cloner as creator and last updater, and leaves external_code empty', async () => {
        const original = await CasesMother.createCase(repository, { external_code: `EXT-${uuidv4()}` });

        const newId = uuidv4();
        await new CaseCloner(repository, auxCasesRepository, dataStructureFinder).execute(
            original.id.value,
            { id: newId },
            clonerId
        );

        const clonedCase = await repository.connection('cases').first('*').where({ id: newId });
        const originalRow = await repository.connection('cases').first('*').where({ id: original.id.value });
        expect(clonedCase.created_by).toBe(clonerId);
        expect(clonedCase.updated_by).toBe(clonerId);
        expect(clonedCase.external_code).toBeNull();
        expect(originalRow.external_code).toBe(original.external_code.value);
    });
});

describe('CaseCloner — comment', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const auxCasesRepository = new KnexAuxCasesRepository(repository.connection);
    const commentsRepository = new KnexCommentsRepository(repository.connection);
    const dataStructureFinder = dataStructureFinderFor(repository.connection);
    const clonerWithComments = () =>
        new CaseCloner(repository, auxCasesRepository, dataStructureFinder, new CommentCreator(commentsRepository));
    const commentDto = () => ({ id: uuidv4(), descripcion: 'cloned for follow-up', created_at: new Date() });

    it('saves the comment on the cloned case, attributed to the cloner', async () => {
        const original = await CasesMother.createCase(repository);
        const comment = commentDto();

        const newId = uuidv4();
        await clonerWithComments().execute(original.id.value, { id: newId }, clonerId, comment);

        const saved = await repository.connection('comentarios').first('*').where({ id: comment.id });
        expect(saved.caso_id).toBe(newId);
        expect(saved.created_by).toBe(clonerId);
    });

    it('persists neither the clone nor its aux_cases when the comment fails, so a retry succeeds', async () => {
        const original = await CasesMother.createCase(repository);
        await AuxCasesMother.createAuxCase(auxCasesRepository, { caso_id: original.id.value });
        const comment = commentDto();
        const newId = uuidv4();
        const saveSpy = jest.spyOn(commentsRepository, 'save').mockRejectedValueOnce(new Error('comment write failed'));

        try {
            await expect(
                clonerWithComments().execute(original.id.value, { id: newId }, clonerId, comment)
            ).rejects.toThrow('comment write failed');
        } finally {
            saveSpy.mockRestore();
        }

        expect(await repository.connection('cases').first('id').where({ id: newId })).toBeUndefined();
        expect(await repository.connection('aux_cases').first('id').where({ caso_id: newId })).toBeUndefined();

        await clonerWithComments().execute(original.id.value, { id: newId }, clonerId, comment);

        expect(await repository.connection('cases').first('id').where({ id: newId })).toBeDefined();
        expect(await repository.connection('comentarios').first('id').where({ id: comment.id })).toBeDefined();
    });
});
