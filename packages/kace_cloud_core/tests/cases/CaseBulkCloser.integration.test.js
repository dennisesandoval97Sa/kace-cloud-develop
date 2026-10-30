import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { CaseBulkCloser, KnexCaseRepository } from '../../src/cases';
import { KnexCommentsRepository } from '../../src/comments';
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

describe('CaseBulkCloser integration tests', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const commentsRepository = new KnexCommentsRepository(repository.connection);
    const flowRepo = new KnexFlowRepository(repository.connection);
    const stateRepo = new KnexStateRepository(repository.connection);
    const transitionRepo = new KnexTransitionsRepository(repository.connection);
    const groupsRepository = new KnexGroupsRepository(repository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(repository.connection);
    const clientRepository = new KnexClientRepository(repository.connection);
    const usersRepository = new KnexUsersRepository(repository.connection);
    const classificationRepository = new KnexClassificationRepository(repository.connection);

    const currentUser = new User({
        permissions: { administrador: [{ module_id: 'cases', name: 'CaseClose', granted: true }] },
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

        return { kase1, kase2 };
    }

    it('closes multiple cases successfully with correct fields persisted', async () => {
        const { kase1, kase2 } = await seedTwoCases();
        const closeReason = 'Resolved bulk';

        const closer = new CaseBulkCloser(repository, currentUser);
        await closer.execute([kase1.id.value, kase2.id.value], closeReason);

        const r1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });
        const r2 = await repository.connection('cases').first('*').where({ id: kase2.id.value });

        expect(r1.fecha_resolucion).not.toBeNull();
        expect(r2.fecha_resolucion).not.toBeNull();
        expect(r1.motivo_baja).toBe(closeReason);
        expect(r2.motivo_baja).toBe(closeReason);
        expect(r1.update_source).toBe(ValueObjectUpdateSource.BULK);
        expect(r2.update_source).toBe(ValueObjectUpdateSource.BULK);
        expect(r1.updated_by).toBe(currentUser.id.value);
        expect(r2.updated_by).toBe(currentUser.id.value);
        expect(r1.edited_by).toBe(currentUser.id.value);
        expect(r2.edited_by).toBe(currentUser.id.value);
        expect(r1.edited_at).not.toBeNull();
        expect(r2.edited_at).not.toBeNull();
    });

    it('does not set or overwrite edited_by and edited_at when closed by a service account', async () => {
        const { kase1, kase2 } = await seedTwoCases();
        const originalEditedAt = new Date('2026-01-01T10:00:00Z').toISOString();
        await repository.connection('cases').whereIn('id', [kase1.id.value, kase2.id.value]).update({
            edited_by: currentUser.id.value,
            edited_at: originalEditedAt,
        });

        const serviceUser = new User({
            permissions: { administrador: [{ module_id: 'cases', name: 'CaseClose', granted: true }] },
            ...UsersMother.dto(),
            account_type: 2,
        });

        const closer = new CaseBulkCloser(repository, serviceUser);
        await closer.execute([kase1.id.value, kase2.id.value], 'Closed by service');

        const r1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });
        const r2 = await repository.connection('cases').first('*').where({ id: kase2.id.value });

        expect(r1.edited_by).toBe(currentUser.id.value);
        expect(new Date(r1.edited_at).toISOString()).toBe(new Date(originalEditedAt).toISOString());
        expect(r2.edited_by).toBe(currentUser.id.value);
        expect(new Date(r2.edited_at).toISOString()).toBe(new Date(originalEditedAt).toISOString());
    });

    it('logs a case.closed event for each closed case', async () => {
        const { kase1, kase2 } = await seedTwoCases();
        const closeReason = 'Resolved bulk';

        const closer = new CaseBulkCloser(repository, currentUser);
        await closer.execute([kase1.id.value, kase2.id.value], closeReason);

        const eventLogs = await repository
            .connection('event_logs')
            .whereIn('aggregate_id', [kase1.id.value, kase2.id.value])
            .andWhere({ event_name: 'case.closed' });

        expect(eventLogs).toHaveLength(2);
        for (const eventLog of eventLogs) {
            expect(eventLog.event_name).toBe('case.closed');
            expect(eventLog.initiated_by_user).toBe(currentUser.id.value);
            expect(eventLog.body.motivo_baja).toBe(closeReason);
            expect(eventLog.body.update_source).toBe(ValueObjectUpdateSource.BULK);
        }
    });

    it('throws CustomError 404 when a case_id is missing', async () => {
        const { kase1 } = await seedTwoCases();
        const missingCaseId = uuidv4();
        const closer = new CaseBulkCloser(repository, currentUser);

        await expect(closer.execute([kase1.id.value, missingCaseId], 'Motivo')).rejects.toMatchObject({
            statusCode: 404,
        });
    });

    it('creates one comment per case with the close reason when commentsRepository is provided', async () => {
        const { kase1, kase2 } = await seedTwoCases();
        const closeReason = 'Resolved bulk with comment';

        const closer = new CaseBulkCloser(repository, currentUser, commentsRepository);
        await closer.execute([kase1.id.value, kase2.id.value], closeReason);

        const comments = await repository
            .connection('comentarios')
            .whereIn('caso_id', [kase1.id.value, kase2.id.value]);

        expect(comments).toHaveLength(2);
        for (const comment of comments) {
            expect(comment.descripcion).toBe(closeReason);
            expect(comment.created_by).toBe(currentUser.id.value);
        }
    });

    it('rolls back the close of every case when the close reason is not a valid comment', async () => {
        const { kase1, kase2 } = await seedTwoCases();
        const caseIds = [kase1.id.value, kase2.id.value];

        const closer = new CaseBulkCloser(repository, currentUser, commentsRepository);
        await expect(closer.execute(caseIds, 'ab')).rejects.toBeDefined();

        const rows = await repository.connection('cases').whereIn('id', caseIds);
        expect(rows).toHaveLength(2);
        for (const row of rows) {
            expect(row.fecha_resolucion).toBeNull();
        }
        const comments = await repository.connection('comentarios').whereIn('caso_id', caseIds);
        expect(comments).toHaveLength(0);
    });

    it('does not create comments when commentsRepository is not provided', async () => {
        const { kase1, kase2 } = await seedTwoCases();

        const closer = new CaseBulkCloser(repository, currentUser);
        await closer.execute([kase1.id.value, kase2.id.value], 'Resolved bulk no comments');

        const comments = await repository
            .connection('comentarios')
            .whereIn('caso_id', [kase1.id.value, kase2.id.value]);

        expect(comments).toHaveLength(0);
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

        const closer = new CaseBulkCloser(repository, currentUser);
        await expect(closer.execute([kase1.id.value, kaseClosed.id.value], 'Motivo')).rejects.toMatchObject({
            message: 'Some cases are already closed',
            statusCode: 400,
        });
    });
});
