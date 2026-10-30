import { knexConfig } from '../knexfile.js';
import { KnexCaseRepository } from '../../src/cases/infrastructure/persistence/KnexCaseRepository.js';
import { KnexFlowRepository } from '../../src/flow';
import { KnexTransitionsRepository } from '../../src/transition';
import { KnexStateRepository } from '../../src/state';
import { KnexGroupsRepository } from '../../src/grupos';
import { KnexShiftManagementRepository } from '../../src/shift-management';
import { KnexClientRepository } from '../../src/clients';
import { KnexUsersRepository } from '../../src/users';
import { KnexClassificationRepository } from '../../src/classifications';
import FlowsMother from '../flow/domain/FlowsMother';
import { TransitionsMother } from '../transition/domain/TransitionsMother';
import { StateMother } from '../state/domain/StateMother';
import CasesMother from './domain/CasesMother';
import ClientMother from '../clients/domain/ClientMother';
import UsersMother from '../users/domain/UsersMother';
import ClassificationsMother from '../classifications/domain/ClassificationsMother';
import { GroupsMother } from '../grupos/domain/GroupsMother';

describe('KnexCaseRepository.findByIdForAvailableStates', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const flowRepo = new KnexFlowRepository(repository.connection);
    const stateRepo = new KnexStateRepository(repository.connection);
    const transitionRepo = new KnexTransitionsRepository(repository.connection);
    const groupsRepository = new KnexGroupsRepository(repository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(repository.connection);
    const clientRepository = new KnexClientRepository(repository.connection);
    const usersRepository = new KnexUsersRepository(repository.connection);
    const classificationRepository = new KnexClassificationRepository(repository.connection);

    async function seedCaseInState(flow, currentState) {
        const client = await ClientMother.createClient(clientRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        // T_prev: the transition that placed the case in currentState
        const T_prev = await TransitionsMother.createTransition(transitionRepo, null, flow, currentState);
        const kase = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: T_prev.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });
        return kase;
    }

    it('excludes self-loop transitions (current state → current state) from available options', async () => {
        const flow = await FlowsMother.createFlow(flowRepo);
        const stateA = await StateMother.createState(stateRepo);
        const stateB = await StateMother.createState(stateRepo);

        const kase = await seedCaseInState(flow, stateA);

        // self-loop: stateA → stateA — must NOT appear
        await TransitionsMother.createTransition(transitionRepo, stateA, flow, stateA);
        // valid forward transition: stateA → stateB — must appear
        const T_forward = await TransitionsMother.createTransition(transitionRepo, stateA, flow, stateB);

        const result = await repository.findByIdForAvailableStates(kase.id);

        expect(result).toHaveLength(1);
        expect(result[0].estado_siguiente.id.value).toBe(stateB.id.value);
        expect(result[0].transition.id.value).toBe(T_forward.id.value);
    });

    it('returns empty array when the only available transition is a self-loop', async () => {
        const flow = await FlowsMother.createFlow(flowRepo);
        const stateA = await StateMother.createState(stateRepo);

        const kase = await seedCaseInState(flow, stateA);

        // only a self-loop exists from stateA
        await TransitionsMother.createTransition(transitionRepo, stateA, flow, stateA);

        const result = await repository.findByIdForAvailableStates(kase.id);

        expect(result).toHaveLength(0);
    });

    it('returns all valid forward transitions when no self-loops exist', async () => {
        const flow = await FlowsMother.createFlow(flowRepo);
        const stateA = await StateMother.createState(stateRepo);
        const stateB = await StateMother.createState(stateRepo);
        const stateC = await StateMother.createState(stateRepo);

        const kase = await seedCaseInState(flow, stateA);

        const T1 = await TransitionsMother.createTransition(transitionRepo, stateA, flow, stateB);
        const T2 = await TransitionsMother.createTransition(transitionRepo, stateA, flow, stateC);

        const result = await repository.findByIdForAvailableStates(kase.id);

        expect(result).toHaveLength(2);
        const transitionIds = result.map((r) => r.transition.id.value);
        expect(transitionIds).toContain(T1.id.value);
        expect(transitionIds).toContain(T2.id.value);
    });
});
