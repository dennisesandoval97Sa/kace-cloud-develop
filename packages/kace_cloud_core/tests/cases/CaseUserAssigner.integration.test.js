import { knexConfig } from '../knexfile.js';
import { KnexCaseRepository } from '../../src/cases';
import { CaseUserAssigner } from '../../src/cases/application/assign/CaseUserAssigner.js';
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
import { ValueObjectUpdateSource } from '../../src/cases/domain/ValueObjectUpdateSource.js';

describe('CaseUserAssigner — assignment_change_type', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const flowRepo = new KnexFlowRepository(repository.connection);
    const stateRepo = new KnexStateRepository(repository.connection);
    const transitionRepo = new KnexTransitionsRepository(repository.connection);
    const groupsRepository = new KnexGroupsRepository(repository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(repository.connection);
    const clientRepository = new KnexClientRepository(repository.connection);
    const usersRepository = new KnexUsersRepository(repository.connection);
    const classificationRepository = new KnexClassificationRepository(repository.connection);

    const currentUser = new User({
        permissions: {
            administrador: [{ module_id: 'user-cases-assigment', name: 'UserCasesAssigmentCreate', granted: true }],
        },
        ...UsersMother.dto(),
    });

    it('persists assignment_change_type=manual on a user reassignment', async () => {
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

        const assigner = new CaseUserAssigner(repository, usersRepository, groupsRepository, currentUser);
        await assigner.execute(kase.id.value, group.id.value, targetUser.id.value, ValueObjectUpdateSource.MANUAL);

        const row = await repository.connection('cases').first('*').where({ id: kase.id.value });
        expect(row.responsable_id).toBe(targetUser.id.value);
        expect(row.assignment_change_type).toBe('manual');
    });

    it('persists edited_by and edited_at when assigned by a regular user', async () => {
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

        const assigner = new CaseUserAssigner(repository, usersRepository, groupsRepository, currentUser);
        await assigner.execute(kase.id.value, group.id.value, targetUser.id.value, ValueObjectUpdateSource.MANUAL);

        const row = await repository.connection('cases').first('*').where({ id: kase.id.value });
        expect(row.edited_by).toBe(currentUser.id.value);
        expect(row.edited_at).not.toBeNull();
    });

    it('does not set or overwrite edited_by and edited_at when assigned by a service account', async () => {
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

        const assigner = new CaseUserAssigner(repository, usersRepository, groupsRepository, serviceUser);
        await assigner.execute(kase.id.value, group.id.value, targetUser.id.value, ValueObjectUpdateSource.MANUAL);

        const row = await repository.connection('cases').first('*').where({ id: kase.id.value });
        expect(row.edited_by).toBe(currentUser.id.value);
        expect(new Date(row.edited_at).toISOString()).toBe(new Date(originalEditedAt).toISOString());
    });
});
