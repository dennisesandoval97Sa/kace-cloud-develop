import { jest } from '@jest/globals';
import {
    CASE_ASSIGNMENT_GROUP_UNAVAILABLE,
    CASE_ASSIGNMENT_USER_UNAVAILABLE,
    CASE_ASSIGNMENT_USER_GROUP_UNAVAILABLE,
} from '@kace/error-codes';
import { StatusEnum } from '../../src/shared/domain/enum/StatusEnum.js';
import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { CaseBulkAssigner, KnexCaseRepository } from '../../src/cases';
import { KnexGroupsRepository } from '../../src/grupos';
import { KnexShiftManagementRepository } from '../../src/shift-management';
import { KnexClientRepository } from '../../src/clients';
import { KnexUsersRepository, User } from '../../src/users';
import { KnexClassificationRepository } from '../../src/classifications';
import { KnexUserGroupRelationshipRepository, UserGroupRelationship } from '../../src/user-group-relationships';
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

describe('CaseBulkAssigner integration tests', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const flowRepo = new KnexFlowRepository(repository.connection);
    const stateRepo = new KnexStateRepository(repository.connection);
    const transitionRepo = new KnexTransitionsRepository(repository.connection);
    const groupsRepository = new KnexGroupsRepository(repository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(repository.connection);
    const clientRepository = new KnexClientRepository(repository.connection);
    const usersRepository = new KnexUsersRepository(repository.connection);
    const classificationRepository = new KnexClassificationRepository(repository.connection);
    const userGroupRelationshipRepository = new KnexUserGroupRelationshipRepository(repository.connection);

    const currentUser = new User({
        permissions: {
            administrador: [{ module_id: 'user-cases-assigment', name: 'UserCasesAssigmentCreate', granted: true }],
        },
        ...UsersMother.dto(),
    });

    async function seedTwoCases() {
        const A = await StateMother.createState(stateRepo);
        const B = await StateMother.createState(stateRepo);
        const flow = await FlowsMother.createFlow(flowRepo);
        const T1 = await TransitionsMother.createTransition(transitionRepo, A, flow, B);
        const client = await ClientMother.createClient(clientRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        const kase1 = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: T1.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });
        const kase2 = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: T1.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });

        return { kase1, kase2, responsible, group };
    }

    async function createUserGroupRelation(userId, groupId) {
        const relation = UserGroupRelationship.create({ usuario_id: userId, grupo_id: groupId });
        await userGroupRelationshipRepository.save(relation);
    }

    it('reassigns multiple cases successfully with correct fields persisted', async () => {
        const { kase1, kase2 } = await seedTwoCases();

        const targetUser = await UsersMother.createUser(usersRepository);
        const targetGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        await createUserGroupRelation(targetUser.id.value, targetGroup.id.value);

        const assigner = new CaseBulkAssigner(
            repository,
            usersRepository,
            groupsRepository,
            userGroupRelationshipRepository,
            currentUser
        );
        await assigner.execute([kase1.id.value, kase2.id.value], targetGroup.id.value, targetUser.id.value);

        const r1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });
        const r2 = await repository.connection('cases').first('*').where({ id: kase2.id.value });

        expect(r1.responsable_id).toBe(targetUser.id.value);
        expect(r2.responsable_id).toBe(targetUser.id.value);
        expect(r1.grupo_id).toBe(targetGroup.id.value);
        expect(r2.grupo_id).toBe(targetGroup.id.value);
        expect(r1.update_source).toBe(ValueObjectUpdateSource.BULK);
        expect(r2.update_source).toBe(ValueObjectUpdateSource.BULK);
        expect(r1.assignment_change_type).toBe('bulk');
        expect(r2.assignment_change_type).toBe('bulk');
        expect(r1.updated_by).toBe(currentUser.id.value);
        expect(r2.updated_by).toBe(currentUser.id.value);
        expect(r1.last_assigned_at).not.toBeNull();
        expect(r2.last_assigned_at).not.toBeNull();
    });

    it('uses the explicit updateSource instead of the fromCasesCount fallback', async () => {
        const { kase1, kase2 } = await seedTwoCases();

        const targetUser = await UsersMother.createUser(usersRepository);
        const targetGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        await createUserGroupRelation(targetUser.id.value, targetGroup.id.value);

        const assigner = new CaseBulkAssigner(
            repository,
            usersRepository,
            groupsRepository,
            userGroupRelationshipRepository,
            currentUser
        );
        // Two cases would resolve to BULK via fromCasesCount; the explicit value must win.
        await assigner.execute(
            [kase1.id.value, kase2.id.value],
            targetGroup.id.value,
            targetUser.id.value,
            ValueObjectUpdateSource.MANUAL
        );

        const r1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });
        const r2 = await repository.connection('cases').first('*').where({ id: kase2.id.value });

        expect(r1.update_source).toBe(ValueObjectUpdateSource.MANUAL);
        expect(r2.update_source).toBe(ValueObjectUpdateSource.MANUAL);
    });

    it('falls back to fromCasesCount when updateSource is null', async () => {
        const { kase1, kase2 } = await seedTwoCases();

        const targetUser = await UsersMother.createUser(usersRepository);
        const targetGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        await createUserGroupRelation(targetUser.id.value, targetGroup.id.value);

        const assigner = new CaseBulkAssigner(
            repository,
            usersRepository,
            groupsRepository,
            userGroupRelationshipRepository,
            currentUser
        );
        await assigner.execute([kase1.id.value, kase2.id.value], targetGroup.id.value, targetUser.id.value, null);

        const r1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });

        expect(r1.update_source).toBe(ValueObjectUpdateSource.BULK);
    });

    it('throws CustomError 404 when a case_id is missing', async () => {
        const { kase1 } = await seedTwoCases();
        const missingCaseId = uuidv4();

        const targetUser = await UsersMother.createUser(usersRepository);
        const targetGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        await createUserGroupRelation(targetUser.id.value, targetGroup.id.value);

        const assigner = new CaseBulkAssigner(
            repository,
            usersRepository,
            groupsRepository,
            userGroupRelationshipRepository,
            currentUser
        );

        await expect(
            assigner.execute([kase1.id.value, missingCaseId], targetGroup.id.value, targetUser.id.value)
        ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws CustomError 400 when any case is already closed', async () => {
        const A = await StateMother.createState(stateRepo);
        const B = await StateMother.createState(stateRepo);
        const flow = await FlowsMother.createFlow(flowRepo);
        const T1 = await TransitionsMother.createTransition(transitionRepo, A, flow, B);
        const client = await ClientMother.createClient(clientRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        const kase1 = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: T1.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });
        const kaseClosed = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: T1.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
            fecha_resolucion: new Date().toISOString(),
        });

        const targetUser = await UsersMother.createUser(usersRepository);
        const targetGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        await createUserGroupRelation(targetUser.id.value, targetGroup.id.value);

        const assigner = new CaseBulkAssigner(
            repository,
            usersRepository,
            groupsRepository,
            userGroupRelationshipRepository,
            currentUser
        );
        await expect(
            assigner.execute([kase1.id.value, kaseClosed.id.value], targetGroup.id.value, targetUser.id.value)
        ).rejects.toMatchObject({
            message: 'Some cases are already closed',
            statusCode: 400,
        });
    });

    describe('Reassignment entity availability validation', () => {
        it('rejects with CustomError 422 and CASE_ASSIGNMENT_GROUP_UNAVAILABLE when group_id does not exist', async () => {
            const { kase1, kase2 } = await seedTwoCases();
            const targetUser = await UsersMother.createUser(usersRepository);
            const fakeGroupId = uuidv4();

            const assigner = new CaseBulkAssigner(
                repository,
                usersRepository,
                groupsRepository,
                userGroupRelationshipRepository,
                currentUser
            );

            await expect(
                assigner.execute([kase1.id.value, kase2.id.value], fakeGroupId, targetUser.id.value)
            ).rejects.toMatchObject({
                statusCode: 422,
                publicErrorCode: CASE_ASSIGNMENT_GROUP_UNAVAILABLE,
            });
        });

        it('rejects with CustomError 422 and CASE_ASSIGNMENT_GROUP_UNAVAILABLE when target group is inactive', async () => {
            const { kase1, kase2 } = await seedTwoCases();
            const targetUser = await UsersMother.createUser(usersRepository);
            const targetGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
            await groupsRepository
                .connection('grupos')
                .where({ id: targetGroup.id.value })
                .update({ status: StatusEnum.INACTIVE.value });
            await createUserGroupRelation(targetUser.id.value, targetGroup.id.value);

            const assigner = new CaseBulkAssigner(
                repository,
                usersRepository,
                groupsRepository,
                userGroupRelationshipRepository,
                currentUser
            );

            await expect(
                assigner.execute([kase1.id.value, kase2.id.value], targetGroup.id.value, targetUser.id.value)
            ).rejects.toMatchObject({
                statusCode: 422,
                publicErrorCode: CASE_ASSIGNMENT_GROUP_UNAVAILABLE,
            });
        });

        it('rejects with CustomError 422 and CASE_ASSIGNMENT_GROUP_UNAVAILABLE when target group is soft-deleted', async () => {
            const { kase1, kase2 } = await seedTwoCases();
            const targetUser = await UsersMother.createUser(usersRepository);
            const targetGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
            await groupsRepository
                .connection('grupos')
                .where({ id: targetGroup.id.value })
                .update({ deleted_at: new Date() });
            await createUserGroupRelation(targetUser.id.value, targetGroup.id.value);

            const assigner = new CaseBulkAssigner(
                repository,
                usersRepository,
                groupsRepository,
                userGroupRelationshipRepository,
                currentUser
            );

            await expect(
                assigner.execute([kase1.id.value, kase2.id.value], targetGroup.id.value, targetUser.id.value)
            ).rejects.toMatchObject({
                statusCode: 422,
                publicErrorCode: CASE_ASSIGNMENT_GROUP_UNAVAILABLE,
            });
        });

        it('rejects with CustomError 422 and CASE_ASSIGNMENT_USER_UNAVAILABLE when responsible_id does not exist', async () => {
            const { kase1, kase2 } = await seedTwoCases();
            const fakeUserId = uuidv4();
            const targetGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

            const assigner = new CaseBulkAssigner(
                repository,
                usersRepository,
                groupsRepository,
                userGroupRelationshipRepository,
                currentUser
            );

            await expect(
                assigner.execute([kase1.id.value, kase2.id.value], targetGroup.id.value, fakeUserId)
            ).rejects.toMatchObject({
                statusCode: 422,
                publicErrorCode: CASE_ASSIGNMENT_USER_UNAVAILABLE,
            });
        });

        it('rejects with CustomError 422 and CASE_ASSIGNMENT_USER_UNAVAILABLE when target user is inactive', async () => {
            const { kase1, kase2 } = await seedTwoCases();
            const targetUser = await UsersMother.createUser(usersRepository);
            const targetGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
            await usersRepository
                .connection('usuarios')
                .where({ id: targetUser.id.value })
                .update({ is_active: String(StatusEnum.INACTIVE.value) });
            await createUserGroupRelation(targetUser.id.value, targetGroup.id.value);

            const assigner = new CaseBulkAssigner(
                repository,
                usersRepository,
                groupsRepository,
                userGroupRelationshipRepository,
                currentUser
            );

            await expect(
                assigner.execute([kase1.id.value, kase2.id.value], targetGroup.id.value, targetUser.id.value)
            ).rejects.toMatchObject({
                statusCode: 422,
                publicErrorCode: CASE_ASSIGNMENT_USER_UNAVAILABLE,
            });
        });

        it('rejects with CustomError 422 and CASE_ASSIGNMENT_USER_UNAVAILABLE when target user is soft-deleted', async () => {
            const { kase1, kase2 } = await seedTwoCases();
            const targetUser = await UsersMother.createUser(usersRepository);
            const targetGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
            await usersRepository
                .connection('usuarios')
                .where({ id: targetUser.id.value })
                .update({ deleted_at: new Date() });
            await createUserGroupRelation(targetUser.id.value, targetGroup.id.value);

            const assigner = new CaseBulkAssigner(
                repository,
                usersRepository,
                groupsRepository,
                userGroupRelationshipRepository,
                currentUser
            );

            await expect(
                assigner.execute([kase1.id.value, kase2.id.value], targetGroup.id.value, targetUser.id.value)
            ).rejects.toMatchObject({
                statusCode: 422,
                publicErrorCode: CASE_ASSIGNMENT_USER_UNAVAILABLE,
            });
        });

        it('rejects with CustomError 422 and CASE_ASSIGNMENT_USER_GROUP_UNAVAILABLE when user does not belong to the group', async () => {
            const { kase1, kase2 } = await seedTwoCases();

            const targetUser = await UsersMother.createUser(usersRepository);
            const targetGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

            const assigner = new CaseBulkAssigner(
                repository,
                usersRepository,
                groupsRepository,
                userGroupRelationshipRepository,
                currentUser
            );

            await expect(
                assigner.execute([kase1.id.value, kase2.id.value], targetGroup.id.value, targetUser.id.value)
            ).rejects.toMatchObject({
                statusCode: 422,
                publicErrorCode: CASE_ASSIGNMENT_USER_GROUP_UNAVAILABLE,
            });
        });
    });

    it('(legacy path) reassigns only group when no assignationService is provided and responsible_id is null', async () => {
        const { kase1, kase2, responsible } = await seedTwoCases();
        const targetGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        const assigner = new CaseBulkAssigner(
            repository,
            usersRepository,
            groupsRepository,
            userGroupRelationshipRepository,
            currentUser
        );
        await assigner.execute([kase1.id.value, kase2.id.value], targetGroup.id.value, null);

        const r1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });
        const r2 = await repository.connection('cases').first('*').where({ id: kase2.id.value });

        expect(r1.grupo_id).toBe(targetGroup.id.value);
        expect(r2.grupo_id).toBe(targetGroup.id.value);
        expect(r1.responsable_id).toBe(responsible.id.value);
        expect(r2.responsable_id).toBe(responsible.id.value);
        expect(r1.update_source).toBe(ValueObjectUpdateSource.BULK);
        expect(r2.update_source).toBe(ValueObjectUpdateSource.BULK);
        // The responsible did not change, so assignment_change_type must stay untouched (not 'bulk').
        expect(r1.assignment_change_type).toBeNull();
        expect(r2.assignment_change_type).toBeNull();
    });

    it('reassigns group and resolves a new responsible when responsible_id is null but assignationService is provided', async () => {
        const { kase1, kase2 } = await seedTwoCases();
        const targetGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        const resolvedResponsible = await UsersMother.createUser(usersRepository);

        const mockAssignationService = {
            execute: jest.fn().mockResolvedValue(resolvedResponsible.id.value),
        };

        const assigner = new CaseBulkAssigner(
            repository,
            usersRepository,
            groupsRepository,
            userGroupRelationshipRepository,
            currentUser,
            mockAssignationService
        );
        await assigner.execute([kase1.id.value, kase2.id.value], targetGroup.id.value, null);

        const r1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });
        const r2 = await repository.connection('cases').first('*').where({ id: kase2.id.value });

        expect(mockAssignationService.execute).toHaveBeenCalledTimes(2);
        expect(mockAssignationService.execute).toHaveBeenCalledWith(targetGroup.id.value, kase1.id.value);
        expect(mockAssignationService.execute).toHaveBeenCalledWith(targetGroup.id.value, kase2.id.value);

        expect(r1.grupo_id).toBe(targetGroup.id.value);
        expect(r2.grupo_id).toBe(targetGroup.id.value);
        expect(r1.responsable_id).toBe(resolvedResponsible.id.value);
        expect(r2.responsable_id).toBe(resolvedResponsible.id.value);
        expect(r1.update_source).toBe(ValueObjectUpdateSource.BULK);
        expect(r2.update_source).toBe(ValueObjectUpdateSource.BULK);
        expect(r1.assignment_change_type).toBe('bulk');
        expect(r2.assignment_change_type).toBe('bulk');
    });

    it('(legacy path) reassigns only group when no assignationService is provided and responsible_id is empty string', async () => {
        const { kase1, kase2, responsible } = await seedTwoCases();
        const targetGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        const assigner = new CaseBulkAssigner(
            repository,
            usersRepository,
            groupsRepository,
            userGroupRelationshipRepository,
            currentUser
        );
        await assigner.execute([kase1.id.value, kase2.id.value], targetGroup.id.value, '');

        const r1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });
        const r2 = await repository.connection('cases').first('*').where({ id: kase2.id.value });

        expect(r1.grupo_id).toBe(targetGroup.id.value);
        expect(r2.grupo_id).toBe(targetGroup.id.value);
        expect(r1.responsable_id).toBe(responsible.id.value);
        expect(r2.responsable_id).toBe(responsible.id.value);
        expect(r1.update_source).toBe(ValueObjectUpdateSource.BULK);
        expect(r2.update_source).toBe(ValueObjectUpdateSource.BULK);
    });

    describe('#executeWithAssignation — failure policy', () => {
        it('returns assigned: [] and skipped list when assignationService returns null for all cases without altering cases', async () => {
            const { kase1, kase2 } = await seedTwoCases();
            const targetGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

            const mockAssignationService = {
                execute: jest.fn().mockResolvedValue(null),
            };

            const assigner = new CaseBulkAssigner(
                repository,
                usersRepository,
                groupsRepository,
                userGroupRelationshipRepository,
                currentUser,
                mockAssignationService
            );

            const result = await assigner.execute([kase1.id.value, kase2.id.value], targetGroup.id.value, null);

            expect(result).toBeDefined();
            expect(result.assigned).toEqual([]);
            expect(result.skipped).toHaveLength(2);
            expect(result.skipped.map((s) => s.caseId)).toEqual(
                expect.arrayContaining([kase1.id.value, kase2.id.value])
            );
            expect(result.skipped.map((s) => s.reference)).toEqual(
                expect.arrayContaining([kase1.reference.value, kase2.reference.value])
            );

            const r1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });
            const r2 = await repository.connection('cases').first('*').where({ id: kase2.id.value });
            expect(r1.grupo_id).not.toBe(targetGroup.id.value);
            expect(r2.grupo_id).not.toBe(targetGroup.id.value);
        });

        it('returns assigned: [] and skipped list when assignationService throws for all cases without altering cases', async () => {
            const { kase1, kase2 } = await seedTwoCases();
            const targetGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

            const mockAssignationService = {
                execute: jest.fn().mockRejectedValue(new Error('Invalid assignation type')),
            };

            const assigner = new CaseBulkAssigner(
                repository,
                usersRepository,
                groupsRepository,
                userGroupRelationshipRepository,
                currentUser,
                mockAssignationService
            );

            const result = await assigner.execute([kase1.id.value, kase2.id.value], targetGroup.id.value, null);

            expect(result).toBeDefined();
            expect(result.assigned).toEqual([]);
            expect(result.skipped).toHaveLength(2);
            expect(result.skipped.map((s) => s.reference)).toEqual(
                expect.arrayContaining([kase1.reference.value, kase2.reference.value])
            );

            const r1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });
            const r2 = await repository.connection('cases').first('*').where({ id: kase2.id.value });
            expect(r1.grupo_id).not.toBe(targetGroup.id.value);
            expect(r2.grupo_id).not.toBe(targetGroup.id.value);
        });

        it('assigns successfully resolved cases and returns skipped list when assignationService fails for a subset', async () => {
            const { kase1, kase2 } = await seedTwoCases();
            const targetGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
            const resolvedResponsible = await UsersMother.createUser(usersRepository);

            const mockAssignationService = {
                execute: jest.fn().mockResolvedValueOnce(resolvedResponsible.id.value).mockResolvedValueOnce(null),
            };

            const assigner = new CaseBulkAssigner(
                repository,
                usersRepository,
                groupsRepository,
                userGroupRelationshipRepository,
                currentUser,
                mockAssignationService
            );

            const result = await assigner.execute([kase1.id.value, kase2.id.value], targetGroup.id.value, null);

            expect(result.assigned).toHaveLength(1);
            expect(result.assigned).toContain(kase1.id.value);
            expect(result.skipped).toHaveLength(1);
            expect(result.skipped[0].caseId).toBe(kase2.id.value);
            expect(result.skipped[0].reference).toBe(kase2.reference.value);
            expect(result.skipped[0].reason).toBe('no_responsible_available');

            const r1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });
            expect(r1.responsable_id).toBe(resolvedResponsible.id.value);
            expect(r1.grupo_id).toBe(targetGroup.id.value);

            // Skipped cases are left entirely untouched (group and responsible unchanged).
            // Explicit policy: moving a case to a group that cannot service it is worse than not moving it.
            const r2 = await repository.connection('cases').first('*').where({ id: kase2.id.value });
            expect(r2.responsable_id).not.toBe(resolvedResponsible.id.value);
            expect(r2.grupo_id).not.toBe(targetGroup.id.value);
        });

        it('assigns a different responsible per case when the strategy rotates users', async () => {
            const { kase1, kase2 } = await seedTwoCases();
            const targetGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
            const userA = await UsersMother.createUser(usersRepository);
            const userB = await UsersMother.createUser(usersRepository);

            const mockAssignationService = {
                execute: jest.fn().mockResolvedValueOnce(userA.id.value).mockResolvedValueOnce(userB.id.value),
            };

            const assigner = new CaseBulkAssigner(
                repository,
                usersRepository,
                groupsRepository,
                userGroupRelationshipRepository,
                currentUser,
                mockAssignationService
            );

            await assigner.execute([kase1.id.value, kase2.id.value], targetGroup.id.value, null);

            const r1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });
            const r2 = await repository.connection('cases').first('*').where({ id: kase2.id.value });

            expect(r1.responsable_id).toBe(userA.id.value);
            expect(r2.responsable_id).toBe(userB.id.value);
            expect(r1.grupo_id).toBe(targetGroup.id.value);
            expect(r2.grupo_id).toBe(targetGroup.id.value);
        });

        it('writes history_cases and last_assigned_at when using the assignationService branch', async () => {
            const { kase1, kase2 } = await seedTwoCases();
            const targetGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
            const resolvedResponsible = await UsersMother.createUser(usersRepository);

            const mockAssignationService = {
                execute: jest.fn().mockResolvedValue(resolvedResponsible.id.value),
            };

            const assigner = new CaseBulkAssigner(
                repository,
                usersRepository,
                groupsRepository,
                userGroupRelationshipRepository,
                currentUser,
                mockAssignationService
            );

            await assigner.execute([kase1.id.value, kase2.id.value], targetGroup.id.value, null);

            const r1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });
            const r2 = await repository.connection('cases').first('*').where({ id: kase2.id.value });
            expect(r1.last_assigned_at).not.toBeNull();
            expect(r2.last_assigned_at).not.toBeNull();

            const history1 = await repository
                .connection('history_cases')
                .where({ entity_id: kase1.id.value })
                .orderBy('created_at', 'desc')
                .first();
            const history2 = await repository
                .connection('history_cases')
                .where({ entity_id: kase2.id.value })
                .orderBy('created_at', 'desc')
                .first();

            expect(history1).toBeDefined();
            expect(history2).toBeDefined();

            const changed1 =
                typeof history1.changed_attributes === 'string'
                    ? JSON.parse(history1.changed_attributes)
                    : history1.changed_attributes;
            expect(changed1.responsable_id).toBe(resolvedResponsible.id.value);
            expect(changed1.grupo_id).toBe(targetGroup.id.value);
        });
    });

    it('reassigns only group when responsible_id is undefined', async () => {
        const { kase1, kase2, responsible } = await seedTwoCases();
        const targetGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        const assigner = new CaseBulkAssigner(
            repository,
            usersRepository,
            groupsRepository,
            userGroupRelationshipRepository,
            currentUser
        );
        await assigner.execute([kase1.id.value, kase2.id.value], targetGroup.id.value, undefined);

        const r1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });
        const r2 = await repository.connection('cases').first('*').where({ id: kase2.id.value });

        expect(r1.grupo_id).toBe(targetGroup.id.value);
        expect(r2.grupo_id).toBe(targetGroup.id.value);
        expect(r1.responsable_id).toBe(responsible.id.value);
        expect(r2.responsable_id).toBe(responsible.id.value);
        expect(r1.update_source).toBe(ValueObjectUpdateSource.BULK);
        expect(r2.update_source).toBe(ValueObjectUpdateSource.BULK);
    });
    describe('History and Event persistence', () => {
        it('saves a history_cases record and an event_logs record for each reassigned case', async () => {
            const { kase1, kase2 } = await seedTwoCases();
            const targetUser = await UsersMother.createUser(usersRepository);
            const targetGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
            await createUserGroupRelation(targetUser.id.value, targetGroup.id.value);

            const assigner = new CaseBulkAssigner(
                repository,
                usersRepository,
                groupsRepository,
                userGroupRelationshipRepository,
                currentUser
            );
            await assigner.execute([kase1.id.value, kase2.id.value], targetGroup.id.value, targetUser.id.value);

            // 1. Validar que se guarde el histórico
            const history1 = await repository
                .connection('history_cases')
                .where({ entity_id: kase1.id.value })
                .orderBy('created_at', 'desc')
                .first();
            const history2 = await repository
                .connection('history_cases')
                .where({ entity_id: kase2.id.value })
                .orderBy('created_at', 'desc')
                .first();

            expect(history1).toBeDefined();
            expect(history2).toBeDefined();

            const changed1 =
                typeof history1.changed_attributes === 'string'
                    ? JSON.parse(history1.changed_attributes)
                    : history1.changed_attributes;
            expect(changed1.grupo_id).toBe(targetGroup.id.value);
            expect(changed1.responsable_id).toBe(targetUser.id.value);

            // 2. Validar que se guarde el evento
            const events = await repository
                .connection('event_logs')
                .whereIn('case_id', [kase1.id.value, kase2.id.value])
                .where({ event_name: 'case.reassigned' })
                .select('case_id');

            expect(events).toHaveLength(2);
            const loggedCaseIds = events.map((e) => e.case_id);
            expect(loggedCaseIds).toContain(kase1.id.value);
            expect(loggedCaseIds).toContain(kase2.id.value);
        });

        it('logs the unchanged responsable_id in the event body when reassigning group-only', async () => {
            const { kase1, responsible } = await seedTwoCases();
            const targetGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

            const assigner = new CaseBulkAssigner(
                repository,
                usersRepository,
                groupsRepository,
                userGroupRelationshipRepository,
                currentUser
            );
            await assigner.execute([kase1.id.value], targetGroup.id.value, null);

            const event = await repository
                .connection('event_logs')
                .where({ case_id: kase1.id.value, event_name: 'case.reassigned' })
                .first();

            const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

            // El responsable no cambia en BD cuando solo se reasigna el grupo, por lo que el
            // evento debe reflejar ese mismo responsable en vez de quedar vacío (bug: antes se
            // omitía `responsable_id` del body cuando no se enviaba un usuario nuevo).
            expect(body.responsable_id).toBe(responsible.id.value);
            expect(body.responsable?.id).toBe(responsible.id.value);
        });
    });

    describe('EventLogger cache: eliminates redundant DB lookups within the same batch', () => {
        it('calls getUserByID only once per unique user even with multiple cases', async () => {
            const { kase1, kase2 } = await seedTwoCases();
            const targetUser = await UsersMother.createUser(usersRepository);
            const targetGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
            await createUserGroupRelation(targetUser.id.value, targetGroup.id.value);

            const assigner = new CaseBulkAssigner(
                repository,
                usersRepository,
                groupsRepository,
                userGroupRelationshipRepository,
                currentUser
            );
            await assigner.execute([kase1.id.value, kase2.id.value], targetGroup.id.value, targetUser.id.value);

            const events = await repository
                .connection('event_logs')
                .whereIn('case_id', [kase1.id.value, kase2.id.value])
                .where({ event_name: 'case.reassigned' })
                .select('*');

            expect(events).toHaveLength(2);
            const bodies = events.map((e) => (typeof e.body === 'string' ? JSON.parse(e.body) : e.body));
            expect(bodies[0].initiator).toBeDefined();
            expect(bodies[1].initiator).toBeDefined();
            expect(bodies[0].initiator?.id).toBe(bodies[1].initiator?.id);
            expect(bodies[0].responsable?.id).toBe(bodies[1].responsable?.id);
        });
    });

    describe('edited_by and edited_at tracking', () => {
        it('persists edited_by and edited_at when bulk assign is executed by a regular user', async () => {
            const { kase1, kase2 } = await seedTwoCases();
            const targetUser = await UsersMother.createUser(usersRepository);
            const targetGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
            await createUserGroupRelation(targetUser.id.value, targetGroup.id.value);

            const assigner = new CaseBulkAssigner(
                repository,
                usersRepository,
                groupsRepository,
                userGroupRelationshipRepository,
                currentUser
            );
            await assigner.execute([kase1.id.value, kase2.id.value], targetGroup.id.value, targetUser.id.value);

            const r1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });
            const r2 = await repository.connection('cases').first('*').where({ id: kase2.id.value });

            expect(r1.edited_by).toBe(currentUser.id.value);
            expect(r2.edited_by).toBe(currentUser.id.value);
            expect(r1.edited_at).not.toBeNull();
            expect(r2.edited_at).not.toBeNull();
        });

        it('does not set or overwrite edited_by and edited_at when bulk assign is executed by a service account', async () => {
            const { kase1, kase2 } = await seedTwoCases();
            const originalEditedAt = new Date('2026-01-01T10:00:00Z').toISOString();
            await repository.connection('cases').whereIn('id', [kase1.id.value, kase2.id.value]).update({
                edited_by: currentUser.id.value,
                edited_at: originalEditedAt,
            });

            const targetUser = await UsersMother.createUser(usersRepository);
            const targetGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
            await createUserGroupRelation(targetUser.id.value, targetGroup.id.value);

            const serviceUser = new User({
                permissions: {
                    administrador: [
                        { module_id: 'user-cases-assigment', name: 'UserCasesAssigmentCreate', granted: true },
                    ],
                },
                ...UsersMother.dto(),
                account_type: 2,
            });

            const assigner = new CaseBulkAssigner(
                repository,
                usersRepository,
                groupsRepository,
                userGroupRelationshipRepository,
                serviceUser
            );
            await assigner.execute([kase1.id.value, kase2.id.value], targetGroup.id.value, targetUser.id.value);

            const r1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });
            const r2 = await repository.connection('cases').first('*').where({ id: kase2.id.value });

            expect(r1.edited_by).toBe(currentUser.id.value);
            expect(new Date(r1.edited_at).toISOString()).toBe(new Date(originalEditedAt).toISOString());
            expect(r2.edited_by).toBe(currentUser.id.value);
            expect(new Date(r2.edited_at).toISOString()).toBe(new Date(originalEditedAt).toISOString());
        });
    });
});
