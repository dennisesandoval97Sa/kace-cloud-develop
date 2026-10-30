import { knexConfig } from '../knexfile.js';
import { KnexCaseRepository } from '../../src/cases';
import { CaseGroupAssigner } from '../../src/cases/application/assign/CaseGroupAssigner.js';
import { CustomError } from '../../src/shared/errors/CustomError.js';
import { CASE_ASSIGNMENT_GROUP_UNAVAILABLE } from '@kace/error-codes';
import { v4 as uuidv4 } from 'uuid';
import { KnexGroupsRepository } from '../../src/grupos';
import { KnexShiftManagementRepository } from '../../src/shift-management';
import { KnexClientRepository } from '../../src/clients';
import { KnexUsersRepository, User } from '../../src/users';
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

describe('CaseGroupAssigner — assignment_change_type', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const flowRepo = new KnexFlowRepository(repository.connection);
    const stateRepo = new KnexStateRepository(repository.connection);
    const transitionRepo = new KnexTransitionsRepository(repository.connection);
    const groupsRepository = new KnexGroupsRepository(repository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(repository.connection);
    const clientRepository = new KnexClientRepository(repository.connection);
    const usersRepository = new KnexUsersRepository(repository.connection);
    const classificationRepository = new KnexClassificationRepository(repository.connection);

    const currentUser = { id: { value: uuidv4() } };

    it('persists assignment_change_type=manual on a group assignment', async () => {
        const A = await StateMother.createState(stateRepo);
        const B = await StateMother.createState(stateRepo);
        const flow = await FlowsMother.createFlow(flowRepo);
        const T1 = await TransitionsMother.createTransition(transitionRepo, A, flow, B);
        const client = await ClientMother.createClient(clientRepository);
        const originalResponsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        const kase = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: T1.id.value,
            responsable_id: originalResponsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });

        const targetUser = await UsersMother.createUser(usersRepository);
        const assignationServiceStub = { executeOrFail: async () => targetUser.id.value };

        const assigner = new CaseGroupAssigner(repository, assignationServiceStub, currentUser);
        await assigner.execute(kase.id.value, group.id.value, [kase.id.value]);

        const row = await repository.connection('cases').first('*').where({ id: kase.id.value });
        expect(row.responsable_id).toBe(targetUser.id.value);
        expect(row.assignment_change_type).toBe('manual');
    });

    it('persists edited_by and edited_at when group assignment is executed by a regular user', async () => {
        const A = await StateMother.createState(stateRepo);
        const B = await StateMother.createState(stateRepo);
        const flow = await FlowsMother.createFlow(flowRepo);
        const T1 = await TransitionsMother.createTransition(transitionRepo, A, flow, B);
        const client = await ClientMother.createClient(clientRepository);
        const originalResponsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        const kase = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: T1.id.value,
            responsable_id: originalResponsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });

        const targetUser = await UsersMother.createUser(usersRepository);
        const assignationServiceStub = { executeOrFail: async () => targetUser.id.value };

        const assigner = new CaseGroupAssigner(repository, assignationServiceStub, currentUser);
        await assigner.execute(kase.id.value, group.id.value, [kase.id.value]);

        const row = await repository.connection('cases').first('*').where({ id: kase.id.value });
        expect(row.edited_by).toBe(currentUser.id.value);
        expect(row.edited_at).not.toBeNull();
    });

    it('does not set or overwrite edited_by and edited_at when group assignment is executed by a service account', async () => {
        const A = await StateMother.createState(stateRepo);
        const B = await StateMother.createState(stateRepo);
        const flow = await FlowsMother.createFlow(flowRepo);
        const T1 = await TransitionsMother.createTransition(transitionRepo, A, flow, B);
        const client = await ClientMother.createClient(clientRepository);
        const originalResponsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        const originalEditedAt = new Date('2026-01-01T10:00:00Z').toISOString();
        const kase = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: T1.id.value,
            responsable_id: originalResponsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
            edited_by: currentUser.id.value,
            edited_at: originalEditedAt,
        });

        const serviceUser = new User({
            permissions: {
                administrador: [{ module_id: 'user-cases-assigment', name: 'UserCasesAssigmentCreate', granted: true }],
            },
            ...UsersMother.dto(),
            account_type: 2,
        });

        const targetUser = await UsersMother.createUser(usersRepository);
        const assignationServiceStub = { executeOrFail: async () => targetUser.id.value };

        const assigner = new CaseGroupAssigner(repository, assignationServiceStub, serviceUser);
        await assigner.execute(kase.id.value, group.id.value, [kase.id.value]);

        const row = await repository.connection('cases').first('*').where({ id: kase.id.value });
        expect(row.edited_by).toBe(currentUser.id.value);
        expect(new Date(row.edited_at).toISOString()).toBe(new Date(originalEditedAt).toISOString());
    });

    it('propagates CustomError 422 CASE_ASSIGNMENT_GROUP_UNAVAILABLE when assignationService.executeOrFail fails', async () => {
        const A = await StateMother.createState(stateRepo);
        const B = await StateMother.createState(stateRepo);
        const flow = await FlowsMother.createFlow(flowRepo);
        const T1 = await TransitionsMother.createTransition(transitionRepo, A, flow, B);
        const client = await ClientMother.createClient(clientRepository);
        const originalResponsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        const kase = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: T1.id.value,
            responsable_id: originalResponsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });

        const assignationServiceStub = {
            executeOrFail: async () => {
                throw new CustomError(
                    'The group you are trying to assign does not exist or is unavailable.',
                    422,
                    ['grupoId'],
                    CASE_ASSIGNMENT_GROUP_UNAVAILABLE
                );
            },
        };

        const assigner = new CaseGroupAssigner(repository, assignationServiceStub, currentUser);
        await expect(assigner.execute(kase.id.value, group.id.value, [kase.id.value])).rejects.toMatchObject({
            statusCode: 422,
            publicErrorCode: CASE_ASSIGNMENT_GROUP_UNAVAILABLE,
        });
    });
});
