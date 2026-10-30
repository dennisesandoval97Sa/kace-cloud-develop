import { CasoAnsCalculator, KnexCaseRepository } from '../../src/cases';
import { CustomError } from '../../src/shared/errors/CustomError.js';
import { knexConfig } from '../knexfile.js';
import { v4 as uuidv4 } from 'uuid';
import CasesMother from './domain/CasesMother.js';
import { GroupsMother } from '../grupos/domain/GroupsMother.js';
import ClientMother from '../clients/domain/ClientMother.js';
import { KnexClientRepository } from '../../src/clients/index.js';
import { TransitionsMother } from '../transition/domain/TransitionsMother.js';
import { KnexTransitionsRepository } from '../../src/transition/index.js';
import UsersMother from '../users/domain/UsersMother.js';
import { KnexUsersRepository } from '../../src/users/index.js';
import ClassificationsMother from '../classifications/domain/ClassificationsMother.js';
import { KnexClassificationRepository } from '../../src/classifications/index.js';
import { KnexGroupsRepository } from '../../src/grupos/index.js';
import { KnexShiftManagementRepository } from '../../src/shift-management/index.js';
import AnsMother from '../ans/domain/AnsMother.js';
import { KnexAnsRepository, Types } from '../../src/ans/index.js';

describe('CasoAnsCalculator', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const calculator = new CasoAnsCalculator(repository);

    const ansRepository = new KnexAnsRepository(repository.connection);
    const clientRepository = new KnexClientRepository(repository.connection);
    const transitionRepository = new KnexTransitionsRepository(repository.connection);
    const usersRepository = new KnexUsersRepository(repository.connection);
    const classificationRepository = new KnexClassificationRepository(repository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(repository.connection);
    const groupsRepository = new KnexGroupsRepository(repository.connection);

    it('should not update the case if it is resolved', async () => {
        const transitionAns = await AnsMother.createAns(ansRepository, {
            intermedio: 2,
            vancido: 4,
            medicion_ans_id: Types.HOURS.value,
        });
        const ans = await AnsMother.createAns(ansRepository);
        const client = await ClientMother.createClient(clientRepository);
        const transitions = await TransitionsMother.createRandomTransition(transitionRepository, {
            ans_id: transitionAns.id.value,
        });
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository, {
            ans_id: ans.id.value,
        });
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        const closedCase = await CasesMother.createCase(repository, {
            fecha_resolucion: new Date(),
            cliente_id: client.id.value,
            transicion_id: transitions.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });

        const kaseId = closedCase.id.value;

        await expect(calculator.execute(kaseId)).rejects.toThrow(CustomError);
        await expect(calculator.execute(kaseId)).rejects.toThrow(`the Case with ID ${kaseId} has been finalized`);
    });

    it('should throw an error if the case is not found', async () => {
        const nonExistingId = uuidv4();
        await expect(calculator.execute(nonExistingId)).rejects.toThrow('Case not found');
    });

    it('should update the case if it is not resolved', async () => {
        const transitionAns = await AnsMother.createAns(ansRepository, {
            intermedio: 2,
            vancido: 4,
            medicion_ans_id: Types.HOURS.value,
        });
        const ans = await AnsMother.createAns(ansRepository);
        const client = await ClientMother.createClient(clientRepository);
        const transitions = await TransitionsMother.createRandomTransition(transitionRepository, {
            ans_id: transitionAns.id.value,
        });
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository, {
            ans_id: ans.id.value,
        });
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        const unresolvedCase = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: transitions.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });

        await calculator.execute(unresolvedCase.id.value);

        const kaceResult = await repository.connection(repository.tableName).where({ id: unresolvedCase.id.value });
        expect(kaceResult).not.toBeNull();
    });
});
