import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { CaseCloser, CaseUpdater, KnexCaseRepository, KnexSubcaseRelationshipRepository } from '../../src/cases';
import { CaseBulkTransitionsUpdater } from '../../src/cases/application/bulk-transitions-updater/CaseBulkTransitionsUpdater.js';
import { KnexTransitionsCaseRepository } from '../../src/cases/infrastructure/persistence/KnexTransitionsCaseRepository.js';
import { KnexFlowRepository } from '../../src/flow';
import { KnexTransitionsRepository } from '../../src/transition';
import { KnexStateRepository } from '../../src/state';
import { KnexGroupsRepository } from '../../src/grupos';
import { KnexShiftManagementRepository } from '../../src/shift-management';
import { KnexClientRepository } from '../../src/clients';
import { KnexUsersRepository, User } from '../../src/users';
import { KnexClassificationRepository } from '../../src/classifications';
import { KnexGlobalConfigurationRepository } from '../../src/global-config/index.js';
import FlowsMother from '../flow/domain/FlowsMother';
import { TransitionsMother } from '../transition/domain/TransitionsMother';
import { StateMother } from '../state/domain/StateMother';
import CasesMother from './domain/CasesMother';
import ClientMother from '../clients/domain/ClientMother';
import UsersMother from '../users/domain/UsersMother';
import ClassificationsMother from '../classifications/domain/ClassificationsMother';
import { GroupsMother } from '../grupos/domain/GroupsMother';
import { ensureParentRow } from '../support/ensureParentRow.js';

describe('cases.estado_id sigue a la transición en todos los caminos de escritura', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const flowRepo = new KnexFlowRepository(repository.connection);
    const stateRepo = new KnexStateRepository(repository.connection);
    const transitionRepo = new KnexTransitionsRepository(repository.connection);
    const groupsRepository = new KnexGroupsRepository(repository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(repository.connection);
    const clientRepository = new KnexClientRepository(repository.connection);
    const usersRepository = new KnexUsersRepository(repository.connection);
    const classificationRepository = new KnexClassificationRepository(repository.connection);
    const globalConfigurationRepository = new KnexGlobalConfigurationRepository(repository.connection);
    const subcaseRelationshipRepository = new KnexSubcaseRelationshipRepository(repository.connection);

    const currentUser = new User({
        permissions: { administrador: [{ module_id: 'cases', name: 'CaseUpdateNotOwner', granted: true }] },
        ...UsersMother.dto(),
    });

    const eventPublisherMock = { publishAll: jest.fn(async () => true) };
    const tenant = { id: { value: 'tenant-1' } };

    /**
     * Siembra un flujo lineal A → B → C con sus dos transiciones reales, de forma
     * que `siguiente_estado_id` apunte siempre a un estado que existe.
     */
    async function seedLinearFlow() {
        const A = await StateMother.createState(stateRepo);
        const B = await StateMother.createState(stateRepo);
        const C = await StateMother.createState(stateRepo);
        const flow = await FlowsMother.createFlow(flowRepo);
        const T1 = await TransitionsMother.createTransition(transitionRepo, A, flow, B);
        const T2 = await TransitionsMother.createTransition(transitionRepo, B, flow, C);
        return { states: { A, B, C }, transitions: { T1, T2 } };
    }

    async function seedCase(transicionId) {
        const client = await ClientMother.createClient(clientRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        return CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: transicionId,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });
    }

    async function readCaseRow(caseId) {
        return repository.connection('cases').first('transicion_id', 'estado_id').where({ id: caseId });
    }

    function makeUpdater() {
        return new CaseUpdater(repository, null, currentUser, eventPublisherMock, tenant);
    }

    it('creación: el caso nace con el estado de su transición', async () => {
        const { states, transitions } = await seedLinearFlow();

        const kase = await seedCase(transitions.T1.id.value);

        await expect(readCaseRow(kase.id.value)).resolves.toMatchObject({
            transicion_id: transitions.T1.id.value,
            estado_id: states.B.id.value,
        });
    });

    it('actualización normal: cambiar de transición arrastra el estado', async () => {
        const { states, transitions } = await seedLinearFlow();
        const kase = await seedCase(transitions.T1.id.value);

        await makeUpdater().execute(kase.id.value, {
            transicion_id: transitions.T2.id.value,
            updated_at: new Date(),
            updated_by: currentUser.id.value,
        });

        await expect(readCaseRow(kase.id.value)).resolves.toMatchObject({
            transicion_id: transitions.T2.id.value,
            estado_id: states.C.id.value,
        });
    });

    it('CAS: la escritura condicional de transicion_id arrastra el estado', async () => {
        const { states, transitions } = await seedLinearFlow();
        const kase = await seedCase(transitions.T1.id.value);

        const wrote = await repository.updateColumnIfSnapshotMatches(
            'transicion_id',
            kase.id.value,
            transitions.T1.id.value,
            transitions.T2.id.value
        );

        expect(wrote).toBe(true);
        await expect(readCaseRow(kase.id.value)).resolves.toMatchObject({
            transicion_id: transitions.T2.id.value,
            estado_id: states.C.id.value,
        });
    });

    it('CAS: un snapshot obsoleto no escribe transición ni estado', async () => {
        const { states, transitions } = await seedLinearFlow();
        const kase = await seedCase(transitions.T1.id.value);

        const wrote = await repository.updateColumnIfSnapshotMatches(
            'transicion_id',
            kase.id.value,
            uuidv4(),
            transitions.T2.id.value
        );

        expect(wrote).toBe(false);
        await expect(readCaseRow(kase.id.value)).resolves.toMatchObject({
            transicion_id: transitions.T1.id.value,
            estado_id: states.B.id.value,
        });
    });

    it('transición masiva: todos los casos quedan con el estado de la transición destino', async () => {
        const { states, transitions } = await seedLinearFlow();
        const kase1 = await seedCase(transitions.T1.id.value);
        const kase2 = await seedCase(transitions.T1.id.value);

        const bulkUpdater = new CaseBulkTransitionsUpdater(
            repository,
            new KnexTransitionsCaseRepository(repository.connection),
            currentUser,
            null,
            eventPublisherMock,
            tenant
        );
        await bulkUpdater.execute([kase1.id.value, kase2.id.value], transitions.T2.id.value);

        for (const kase of [kase1, kase2]) {
            await expect(readCaseRow(kase.id.value)).resolves.toMatchObject({
                transicion_id: transitions.T2.id.value,
                estado_id: states.C.id.value,
            });
        }
    });

    it('cierre: cerrar transicionando a la transición final arrastra el estado', async () => {
        const { states, transitions } = await seedLinearFlow();
        const kase = await seedCase(transitions.T1.id.value);
        const closer = new CaseCloser(
            repository,
            groupsRepository,
            globalConfigurationRepository,
            subcaseRelationshipRepository
        );

        await closer.execute(kase.id.value, {
            transicion_id: transitions.T2.id.value,
            updated_by: currentUser.id.value,
        });

        await expect(readCaseRow(kase.id.value)).resolves.toMatchObject({
            transicion_id: transitions.T2.id.value,
            estado_id: states.C.id.value,
        });
    });

    it('una actualización que no toca la transición deja el estado intacto', async () => {
        const { states, transitions } = await seedLinearFlow();
        const kase = await seedCase(transitions.T1.id.value);

        await makeUpdater().execute(kase.id.value, {
            alto_impacto: 1,
            updated_at: new Date(),
            updated_by: currentUser.id.value,
        });

        await expect(readCaseRow(kase.id.value)).resolves.toMatchObject({
            transicion_id: transitions.T1.id.value,
            estado_id: states.B.id.value,
        });
    });

    it('un estado_id fijado explícitamente manda sobre la derivación de la transición', async () => {
        const { states, transitions } = await seedLinearFlow();
        const kase = await seedCase(transitions.T1.id.value);

        await makeUpdater().execute(kase.id.value, {
            transicion_id: transitions.T2.id.value,
            estado_id: states.A.id.value,
            updated_at: new Date(),
            updated_by: currentUser.id.value,
        });

        await expect(readCaseRow(kase.id.value)).resolves.toMatchObject({
            transicion_id: transitions.T2.id.value,
            estado_id: states.A.id.value,
        });
    });

    it('una transición sin siguiente estado deja estado_id en null', async () => {
        const { transitions } = await seedLinearFlow();
        const kase = await seedCase(transitions.T1.id.value);
        const danglingTransitionId = uuidv4();
        await ensureParentRow(repository.connection, 'transiciones', danglingTransitionId);

        await makeUpdater().execute(kase.id.value, {
            transicion_id: danglingTransitionId,
            updated_at: new Date(),
            updated_by: currentUser.id.value,
        });

        await expect(readCaseRow(kase.id.value)).resolves.toMatchObject({
            transicion_id: danglingTransitionId,
            estado_id: null,
        });
    });
});
