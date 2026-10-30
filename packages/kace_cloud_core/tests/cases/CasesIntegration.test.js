import { v4 as uuidv4 } from 'uuid';
import {
    CaseCloner,
    CaseCloser,
    CaseCreator,
    CaseDataGridResponse,
    CaseDeleter,
    CaseFinder,
    CaseReopener,
    CaseResponse,
    CaseSearcher,
    CaseTransitionsFinder,
    CaseUpdater,
    KnexCaseRepository,
} from '../../src/cases/index.js';
import { knexConfig } from '../knexfile.js';
import CasesMother from './domain/CasesMother.js';
import CommentsMother from '../comments/domain/CommentsMother.js';
import { KnexCommentsRepository } from '../../src/comments/index.js';
import { CASE_RECLASSIFY_PERMISSION, CustomError, Helper, ValidationFailError } from '../../src/shared/index.js';
import { CaseTransitionsResponse } from '../../src/cases/application/CaseTransitionsResponse.js';
import { GroupsMother } from '../grupos/domain/GroupsMother.js';
import ClientMother from '../clients/domain/ClientMother.js';
import { TransitionsMother } from '../transition/domain/TransitionsMother.js';
import UsersMother from '../users/domain/UsersMother.js';
import ClassificationsMother from '../classifications/domain/ClassificationsMother.js';
import { KnexClientRepository } from '../../src/clients/index.js';
import { KnexTransitionsRepository } from '../../src/transition/index.js';
import { KnexUsersRepository, User } from '../../src/users/index.js';
import { KnexClassificationRepository } from '../../src/classifications/index.js';
import { KnexGroupsRepository } from '../../src/grupos/index.js';
import { KnexShiftManagementRepository } from '../../src/shift-management/index.js';
import { AuxCasesMother } from '../aux_casos/domain/AuxCasesMother.js';
import { KnexAuxCasesRepository } from '../../src/aux_casos/index.js';
import { AuxDefinitionDataStructureFinder } from '../../src/aux_definitions/application/find/AuxDefinitionDataStructureFinder.js';
import { KnexAuxDefinitionsRepository } from '../../src/aux_definitions/infrastructure/persitance/KnexAuxDefinitionsRepository.js';
import { KnexSchemasRepository } from '../../src/schemas/infrastructure/persistence/KnexSchemasRepository.js';
import { StateMother } from '../state/domain/StateMother.js';
import { SHARED_VISUAL_COLOR_ALLOWLIST } from '../../src/shared/visual-options/sharedVisualOptions.js';
import { KnexStateRepository } from '../../src/state/index.js';
import AnsMother from '../ans/domain/AnsMother.js';
import { KnexAnsRepository, Types } from '../../src/ans/index.js';
import ShiftManagementMother from '../shift-management/domain/ShiftManagementMother.js';
import { KnexGlobalConfigurationRepository } from '../../src/global-config/index.js';
import { KnexSubcaseRelationshipRepository } from '../../src/cases/index.js';
import { GlobalConfigurationsMother } from '../global-config/domain/GlobalConfigurationsMother.js';
import dayjs from 'dayjs';
import { VisibleCaseSearcher } from '../../src/cases/application/search/VisibleCaseSearcher.js';
import ExecuteActionsOnCaseCreated from '../../src/cases/application/event-handlers/ExecuteActionsOnCaseCreated.js';
import FlowsMother from '../flow/domain/FlowsMother.js';
import { KnexFlowRepository } from '../../src/flow/index.js';
import { globalRoleId, globalSystemUserId } from '@kace/database/seeds/20241125105900_usuario_base.js';
import { globalGroupId } from '@kace/database/seeds/20250128045401_rel_user_group.js';
import CaseDescriptionsMother from '../case-descriptions/domain/CaseDescriptionsMother.js';
import { globalConfigurationId } from '@kace/database/seeds/20241125105901_configuration.js';
import { ensureParentRow } from '../support/ensureParentRow.js';

describe('Cases Integration Tests', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const commentRepository = new KnexCommentsRepository(repository.connection);
    const auxCaseRepository = new KnexAuxCasesRepository(repository.connection);
    const ansRepository = new KnexAnsRepository(repository.connection);
    const flowRepository = new KnexFlowRepository(repository.connection);
    const clientRepository = new KnexClientRepository(repository.connection);
    const transitionRepository = new KnexTransitionsRepository(repository.connection);
    const stateRepository = new KnexStateRepository(repository.connection);
    const usersRepository = new KnexUsersRepository(repository.connection);
    const classificationRepository = new KnexClassificationRepository(repository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(repository.connection);
    const groupsRepository = new KnexGroupsRepository(repository.connection);
    const subcaseRelationshipRepository = new KnexSubcaseRelationshipRepository(repository.connection);
    const transitionsRepository = new KnexTransitionsRepository(repository.connection);
    const auxCasesRepository = new KnexAuxCasesRepository(repository.connection);
    const currentUser = new User({
        permissions: { administrador: [{ module_id: 'cases', name: 'CaseUpdateNotOwner', granted: true }] },
        ...UsersMother.dto(),
    });

    const globalConfigurationRepository = new KnexGlobalConfigurationRepository(repository.connection);
    const actionExecutionServiceMock = { execute: async (trigger, caso) => (trigger && caso ? true : null) };

    async function createValidGroup() {
        const config =
            await GlobalConfigurationsMother.createWorkQueueAuxConfigWithSubCases(globalConfigurationRepository);

        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository, {
            configuration_id: config.id.value,
        });
        return group;
    }

    /**
     * `CaseTransitions` resuelve los nombres con leftJoin contra `estados` y `grupos`. Las filas de
     * catalogo que crea `ensureParentRow` llevan solo el id, asi que `estado_actual`,
     * `estado_siguiente` y `grupo` vuelven en null. Los tests de transiciones necesitan filas con
     * nombre real.
     */
    async function createNamedTransition() {
        const [estadoActual, estadoSiguiente] = await Promise.all([
            StateMother.createState(stateRepository, { nombre: 'Estado actual' }),
            StateMother.createState(stateRepository, { nombre: 'Estado siguiente' }),
        ]);

        return TransitionsMother.createRandomTransition(transitionRepository, {
            estado_actual_id: estadoActual.id.value,
            siguiente_estado_id: estadoSiguiente.id.value,
        });
    }

    async function createNamedGroup(nombre) {
        const group = GroupsMother.dto({ nombre });
        await GroupsMother.ensureRelations(repository.connection, group, {});
        await repository.connection('grupos').insert(group);

        return group;
    }

    async function createCaseWithRelations() {
        const client = await ClientMother.createClient(clientRepository, null, {
            created_by: globalSystemUserId,
        });

        const estadoInicial = await StateMother.createState(stateRepository, {
            nombre: 'Recibido',
            created_by: globalSystemUserId,
        });

        const flujo = await FlowsMother.createFlow(flowRepository, {
            nombre: 'Flujo simple',
            created_by: globalSystemUserId,
        });

        const ans = await AnsMother.createAns(ansRepository, {
            created_by: globalSystemUserId,
        });

        const transition = await TransitionsMother.createTransitionFullRelations(transitionsRepository, {
            estado_actual_id: null,
            siguiente_estado_id: estadoInicial.id.value,
            flujo_id: flujo.id.value,
            ans_id: ans.id.value,
            created_by: globalSystemUserId,
        });

        const classification = await ClassificationsMother.createClassificationWithoutFlow(classificationRepository, {
            flujo_id: flujo.id.value,
            ans_id: ans.id.value,
            default_group_id: globalGroupId,
            created_by: globalSystemUserId,
        });

        const caseDescription = await CaseDescriptionsMother.createCaseDescription(caseDescriptionRepository, {
            created_by: globalSystemUserId,
        });

        const shiftManagement = await ShiftManagementMother.createShiftManagement(shiftManagementRepository, {
            created_by: globalSystemUserId,
        });

        const group = await GroupsMother.createGroupWithRelations(groupsRepository, {
            rol_id: globalRoleId,
            horario_id: shiftManagement.id.value,
            configuration_id: globalConfigurationId,
            created_by: globalSystemUserId,
        });

        const kase = await CasesMother.createCaseWithFullRelations(repository, {
            id: 'd5d98028-5e9a-4b22-a072-f51411683106',
            cliente_id: client.id.value,
            transicion_id: transition.id.value,
            clasificacion_id: classification.id.value,
            responsable_id: globalSystemUserId,
            descripcion_caso_id: caseDescription.id.value,
            grupo_id: globalGroupId,
            parent_id: null,
            created_by: globalSystemUserId,
        });

        const auxCase = await AuxCasesMother.createAuxCase(auxCasesRepository, {
            caso_id: kase.id.value,
            created_by: globalSystemUserId,
        });

        return {
            client,
            estadoInicial,
            flujo,
            ans,
            transition,
            classification,
            caseDescription,
            shiftManagement,
            group,
            kase,
            auxCase,
        };
    }

    it('should create case instance', async () => {
        const dto = CasesMother.dto();
        await CasesMother.ensureRelations(repository.connection, dto, {});
        await new CaseCreator(repository, actionExecutionServiceMock).execute(dto);

        const kaceResult = await repository.connection('cases').where({ id: dto.id });

        expect(kaceResult.length).toEqual(1);
        expect(kaceResult[0].assignment_change_type).toBe('creation');
    });

    it('should return the reference after create a case', async () => {
        const dto = CasesMother.dto();
        await CasesMother.ensureRelations(repository.connection, dto, {});
        const response = await new CaseCreator(repository, actionExecutionServiceMock).execute(dto);

        expect(response).toBeInstanceOf(CaseResponse);
        const data = response.toJson();
        expect(response.toJson().data.hasOwnProperty('reference')).toBeTruthy();
    });

    it('can fetch an existing case', async () => {
        const kase = await CasesMother.createCase(repository);
        const caseFinder = new CaseFinder(repository, new User(UsersMother.dto()));

        const kaseFounded = await caseFinder.execute(kase.id.value);

        expect(kaseFounded).toBeInstanceOf(CaseResponse);
        expect(kaseFounded.toJson()).toEqual(expect.any(Object));
    });

    it('persists edited_by and edited_at on repository.save()', async () => {
        const editorId = uuidv4();
        const editedAt = new Date().toISOString();
        const kase = await CasesMother.createCase(repository, {
            edited_by: editorId,
            edited_at: editedAt,
        });

        const raw = await repository.connection('cases').first('edited_by', 'edited_at').where({ id: kase.id.value });
        expect(raw.edited_by).toBe(editorId);
        expect(new Date(raw.edited_at).toISOString()).toBe(new Date(editedAt).toISOString());

        const found = await repository.find(kase.id);
        expect(found.edited_by.value).toBe(editorId);
        expect(new Date(found.edited_at.value).toISOString()).toBe(new Date(editedAt).toISOString());
    });

    it('returns inactive but not soft-deleted attachments when fetching a case with all relations', async () => {
        const kase = await CasesMother.createCaseWithRelations(repository);
        const activeAttachmentId = uuidv4();
        const inactiveAttachmentId = uuidv4();
        const deletedAttachmentId = uuidv4();

        await repository.connection('case_attachments').insert([
            {
                id: activeAttachmentId,
                case_id: kase.id.value,
                description: 'Active attachment',
                size: 100,
                path: 'https://example.com/active.pdf',
                type: 1,
                is_active: true,
            },
            {
                id: inactiveAttachmentId,
                case_id: kase.id.value,
                description: 'Inactive attachment',
                size: 200,
                path: 'https://example.com/inactive.pdf',
                type: 1,
                is_active: false,
            },
            {
                id: deletedAttachmentId,
                case_id: kase.id.value,
                description: 'Deleted attachment',
                size: 300,
                path: 'https://example.com/deleted.pdf',
                type: 1,
                is_active: true,
                deleted_at: new Date().toISOString(),
                deleted_by: uuidv4(),
            },
        ]);

        const caseFinder = new CaseFinder(repository, currentUser);

        const kaseFounded = await caseFinder.executeWithAllRelations(kase.id.value, false);

        expect(
            kaseFounded
                .toJson()
                .data.attachments.map(({ id }) => id)
                .sort()
        ).toEqual([activeAttachmentId, inactiveAttachmentId].sort());
    });

    it('can update an existing case', async () => {
        const kase = await CasesMother.createCase(repository);
        const caseUpdater = new CaseUpdater(repository, actionExecutionServiceMock, currentUser);

        // `vista` y no `antiguedad`: `CaseUpdater.#calculateSLATimers` recalcula
        // `antiguedad` despues de cada update y la pisa con el texto que produce
        // `AnsCalculator` ("Tiempo laboral transcurrido: ..."). El valor del
        // llamante solo sobrevivia mientras la factoria dejaba la cadena ANS rota
        // y el calculo abortaba. `vista` es una columna llana que nadie deriva.
        await caseUpdater.execute(kase.id.value, { vista: 'new vista' });

        const updatedCase = await repository.connection('cases').first('*').where({ id: kase.id.value });

        expect(updatedCase.vista).toBe('new vista');
    });

    it('can update an existing case with all attributes', async () => {
        const kase = await CasesMother.createCase(repository);
        const caseUpdater = new CaseUpdater(repository, actionExecutionServiceMock, currentUser);
        let parent_id = uuidv4();
        const descripcionCasoId = uuidv4();
        await ensureParentRow(repository.connection, 'descripciones_casos', descripcionCasoId);

        const payload = {
            cliente_id: kase.cliente_id.value,
            transicion_id: kase.transicion_id.value,
            responsable_id: kase.responsable_id.value,
            clasificacion_id: kase.clasificacion_id.value,
            descripcion_caso_id: descripcionCasoId,
            grupo_id: kase.grupo_id.value,
            created_at: new Date().toISOString(),
            motivo_baja: 'motivo baja',
            alto_impacto: 0,
            vista: 'vistan update',
            created_by: uuidv4(),
            fecha_resolucion: new Date().toISOString(),
            antiguedad: 'new antiguedad',
            // References the case itself: caso_clonado_id only needs to point at an existing
            // row, and reusing kase.id avoids inserting an extra bare-bones row into `cases`
            // that would pollute later order-sensitive queries sharing this file's database.
            caso_clonado_id: kase.id.value,
            canal_id: 12,
            ans_posicion: 2,
            antiguedad_dias: 2,
            antiguedad_horas: 2,
            antiguedad_minutos: 2,
            cambio_estado_comentario_id: uuidv4(),
            cloned_by: uuidv4(),
            cloned_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            parent_id,
        };

        await caseUpdater.execute(kase.id.value, payload);

        const updatedCase = await repository.connection('cases').first('*').where({ id: kase.id.value });

        expect(updatedCase.antiguedad).toBe('new antiguedad');
        expect(updatedCase.motivo_baja).toBe('motivo baja');
        expect(updatedCase.parent_id).toEqual(parent_id);
    });

    it('should error when try update a non existing case', async () => {
        const caseUpdater = new CaseUpdater(repository, actionExecutionServiceMock, currentUser);

        await expect(caseUpdater.execute(uuidv4(), { antiguedad: 'new antiguedad' })).rejects.toThrow(CustomError);
    });

    it('can fetch cases with search criteria', async () => {
        const client = await ClientMother.createClient(clientRepository);
        const transitions = await TransitionsMother.createTransition(transitionRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        const kaseRandom = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: transitions.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });

        const caseSearcher = new CaseSearcher(repository);

        const dtoCriteria = {
            filter: [
                {
                    field: 'cases.motivo_baja',
                    operator: 'eq',
                    value: kaseRandom.motivo_baja.value,
                    type: 'AND',
                },
            ],
            order: {
                field: 'cases.id',
                direction: 'DESC',
            },
            limit: 1,
            offset: 0,
        };

        const caseData = await caseSearcher.execute(dtoCriteria);

        const caseJson = caseData.toJson();

        expect(caseData).toBeInstanceOf(CaseDataGridResponse);
        expect(caseJson).toEqual(expect.any(Object));
        expect(caseJson.data.items.length).toEqual(1);
        expect(caseJson.data.items[0].motivo_baja).toEqual(kaseRandom.motivo_baja.value);
        expect(caseJson.data.items[0].transicion_id).toEqual(transitions.id.value);
    });

    it('should return countByStatus in metadata when searching cases', async () => {
        const client = await ClientMother.createClient(clientRepository);
        const responsible = await UsersMother.createUserWithRole(usersRepository);
        const flow = await FlowsMother.createFlow(flowRepository);

        const ans = await AnsMother.createAns(ansRepository, {
            intermedio: 1,
            vancido: 2,
            medicion_ans_id: Types.DAYS.value,
        });
        const classification = await ClassificationsMother.createClassification(classificationRepository, {
            flujo_id: flow.id.value,
            ans_id: ans.id.value,
        });
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        const stateA = await StateMother.createState(stateRepository, { nombre: 'Estado A' });
        const stateB = await StateMother.createState(stateRepository, { nombre: 'Estado B' });

        const transitionA = await TransitionsMother.createTransitionWithNullState(
            transitionRepository,
            null,
            flow,
            stateA
        );
        const transitionB = await TransitionsMother.createTransitionWithNullState(
            transitionRepository,
            null,
            flow,
            stateB
        );

        await CasesMother.createCaseWithDescription(repository, {
            cliente_id: client.id.value,
            transicion_id: transitionA.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });
        await CasesMother.createCaseWithDescription(repository, {
            cliente_id: client.id.value,
            transicion_id: transitionA.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });

        await CasesMother.createCaseWithDescription(repository, {
            cliente_id: client.id.value,
            transicion_id: transitionB.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });

        const caseSearcher = new CaseSearcher(repository);

        const dtoCriteria = {
            filter: [],
            order: {
                field: 'cases.id',
                direction: 'DESC',
            },
            limit: 10,
            offset: 0,
        };

        const caseData = await caseSearcher.execute(dtoCriteria);
        const caseJson = caseData.toJson();

        expect(caseData).toBeInstanceOf(CaseDataGridResponse);
        expect(caseJson.metadata).toHaveProperty('countByStatus');
        expect(Array.isArray(caseJson.metadata.countByStatus)).toBe(true);
        const countByStatus = caseJson.metadata.countByStatus;
        const stateACount = countByStatus.find((s) => s.status === 'Estado A');
        const stateBCount = countByStatus.find((s) => s.status === 'Estado B');

        expect(stateACount).toBeDefined();
        expect(stateACount.count).toBe(2);
        expect(stateACount).toHaveProperty('color');
        expect(stateACount.color).toBe(SHARED_VISUAL_COLOR_ALLOWLIST[2]);

        expect(stateBCount).toBeDefined();
        expect(stateBCount.count).toBe(1);
        expect(stateBCount).toHaveProperty('color');
        expect(stateBCount.color).toBe(SHARED_VISUAL_COLOR_ALLOWLIST[2]);

        const totalFromStatus = countByStatus.reduce((sum, s) => sum + s.count, 0);
        expect(Number(totalFromStatus)).toBe(Number(caseJson.metadata.count));
    });

    it('can fetch open cases with search criteria', async () => {
        const client = await ClientMother.createClient(clientRepository);
        const transitions = await TransitionsMother.createTransition(transitionRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: transitions.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });
        const caseSearcher = new CaseSearcher(repository);

        const dtoCriteria = {
            filter: [
                {
                    field: 'fecha_resolucion',
                    operator: 'null',
                    value: 'null',
                    type: 'AND',
                },
            ],
            order: {
                field: 'cases.id',
                direction: 'DESC',
            },
            limit: 1,
            offset: 0,
        };

        const caseData = await caseSearcher.execute(dtoCriteria);

        const caseJson = caseData.toJson();

        expect(caseData).toBeInstanceOf(CaseDataGridResponse);
        expect(caseJson).toEqual(expect.any(Object));
        expect(caseJson.data.items.length).toEqual(1);
        expect(caseJson.data.items[0].fecha_resolucion).toBeNull();
    });

    it('can fetch closed cases with search criteria', async () => {
        const client = await ClientMother.createClient(clientRepository);
        const transitions = await TransitionsMother.createTransition(transitionRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        const parent_id = uuidv4();
        await CasesMother.createCase(repository, {
            fecha_resolucion: new Date(),
            cliente_id: client.id.value,
            transicion_id: transitions.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
            parent_id,
        });
        const caseSearcher = new CaseSearcher(repository);

        const dtoCriteria = {
            filter: [
                {
                    field: 'fecha_resolucion',
                    operator: 'notNull',
                    value: 'notNull',
                    type: 'AND',
                },
            ],
            order: {
                field: 'cases.id',
                direction: 'DESC',
            },
            limit: 1,
            offset: 0,
        };

        const caseData = await caseSearcher.execute(dtoCriteria);

        const caseJson = caseData.toJson();

        expect(caseData).toBeInstanceOf(CaseDataGridResponse);
        expect(caseJson).toEqual(expect.any(Object));
        expect(caseJson.data.items.length).toEqual(1);
        expect(caseJson.data.items[0].fecha_resolucion).not.toBeNull();
        expect(caseJson.data.items[0].parent_id).toEqual(parent_id);
    });

    // Cambiar `clasificacion_id` exige declarar `CaseReclassify` y que el usuario lo tenga; sin
    // ello `CaseUpdater` responde 403 (cubierto en CaseUpdater.integration.test.js).
    it('can reclassify a exist case', async () => {
        const kase = await CasesMother.createCase(repository);
        const reclassifier = new User({
            permissions: {
                administrador: [
                    { module_id: 'cases', name: 'CaseUpdateNotOwner', granted: true },
                    { module_id: 'cases', name: 'CaseReclassify', granted: true },
                ],
            },
            ...UsersMother.dto(),
        });
        const kaseReclassify = new CaseUpdater(repository, actionExecutionServiceMock, reclassifier);

        const clasificacionId = uuidv4();
        const transicionId = uuidv4();
        await ensureParentRow(repository.connection, 'clasificaciones', clasificacionId);
        await ensureParentRow(repository.connection, 'transiciones', transicionId);

        const payload = {
            clasificacion_id: clasificacionId,
            transicion_id: transicionId,
            updated_at: new Date(),
        };

        await kaseReclassify.execute(kase.id.value, payload, true, {
            requiredPermission: CASE_RECLASSIFY_PERMISSION,
        });

        const caseReclassifyied = await repository.connection('cases').first('*').where({ id: kase.id.value });

        expect(caseReclassifyied.clasificacion_id).toBe(payload.clasificacion_id);
        expect(caseReclassifyied.transicion_id).toBe(payload.transicion_id);
    });

    it('can close a exist open case', async () => {
        const group = await createValidGroup();
        const kase = await CasesMother.createCase(repository, { grupo_id: group.id.value });
        const kaseCloser = new CaseCloser(
            repository,
            groupsRepository,
            globalConfigurationRepository,
            subcaseRelationshipRepository
        );

        await kaseCloser.execute(kase.id.value);

        const caseClosed = await repository.connection('cases').first('*').where({ id: kase.id.value });

        expect(caseClosed.fecha_resolucion).not.toBeNull();
    });

    it('should return an error when try close a non exist case', async () => {
        const kaseCloser = new CaseCloser(
            repository,
            groupsRepository,
            globalConfigurationRepository,
            subcaseRelationshipRepository
        );

        await expect(kaseCloser.execute(uuidv4())).rejects.toThrow(CustomError);
    });

    it('can clone a exist case', async () => {
        const kase = await CasesMother.createCase(repository);
        const kaseCloner = new CaseCloner(
            repository,
            new KnexAuxCasesRepository(repository.connection),
            new AuxDefinitionDataStructureFinder(
                new KnexAuxDefinitionsRepository(repository.connection),
                new KnexSchemasRepository(repository.connection)
            )
        );
        const payload = {
            id: uuidv4(),
        };
        await kaseCloner.execute(kase.id.value, payload, uuidv4());

        const caseCloned = await repository.connection('cases').first('*').where({ id: payload.id });

        expect(caseCloned.id).toBeDefined();
        expect(caseCloned.id).not.toBe(kase.id.value);
        expect(caseCloned.caso_clonado_id).toEqual(kase.id.value);
        expect(caseCloned.cloned_at).not.toBeNull();
    });

    it('can clone an existing case with new data', async () => {
        const kase = await CasesMother.createCase(repository);
        const kaseCloner = new CaseCloner(
            repository,
            new KnexAuxCasesRepository(repository.connection),
            new AuxDefinitionDataStructureFinder(
                new KnexAuxDefinitionsRepository(repository.connection),
                new KnexSchemasRepository(repository.connection)
            )
        );
        const transicionId = uuidv4();
        const grupoId = uuidv4();
        const responsableId = uuidv4();
        await ensureParentRow(repository.connection, 'transiciones', transicionId);
        await ensureParentRow(repository.connection, 'grupos', grupoId);
        await ensureParentRow(repository.connection, 'usuarios', responsableId);
        const payload = {
            id: uuidv4(),
            transicion_id: transicionId,
            grupo_id: grupoId,
            responsable_id: responsableId,
        };
        await kaseCloner.execute(kase.id.value, payload, uuidv4());

        const caseCloned = await repository.connection('cases').first('*').where({ id: payload.id });

        expect(caseCloned.id).toBeDefined();
        expect(caseCloned.id).not.toBe(kase.id.value);
        expect(caseCloned.caso_clonado_id).toEqual(kase.id.value);
        expect(caseCloned.transicion_id).toEqual(payload.transicion_id);
        expect(caseCloned.grupo_id).toEqual(payload.grupo_id);
        expect(caseCloned.responsable_id).toEqual(payload.responsable_id);
    });

    it('can reopen a exist closed case', async () => {
        const group = await createValidGroup();
        const closedCasekase = await CasesMother.createCase(repository, {
            fecha_resolucion: new Date(),
            grupo_id: group.id.value,
        });

        const kaseReopen = new CaseReopener(
            repository,
            groupsRepository,
            globalConfigurationRepository,
            commentRepository
        );
        const comment = await CommentsMother.createComment(commentRepository, closedCasekase.id.value);

        const payload = {
            fecha_resolucion: null,
            motivo_baja: null,
            reopen_at: new Date(),
            comentario_cambio_estado_id: comment.id.value,
            reopen_by: uuidv4(),
            updated_at: new Date(),
        };

        await kaseReopen.execute(closedCasekase.id.value, payload, { userGroupId: group.id.value });

        const caseReopened = await repository.connection('cases').first('*').where({ id: closedCasekase.id.value });

        expect(caseReopened.fecha_resolucion).toBeNull();
        expect(caseReopened.motivo_baja).toBeNull();
        expect(caseReopened.reopen_at).not.toBeNull();
        expect(caseReopened.reopen_by).not.toBeNull();
    });

    it('should error when try reopen a exist open case', async () => {
        const kase = await CasesMother.createCase(repository);
        const kaseReopen = new CaseReopener(
            repository,
            groupsRepository,
            globalConfigurationRepository,
            commentRepository
        );
        const comment = await CommentsMother.createComment(commentRepository, kase.id.value);

        const payload = {
            fecha_resolucion: null,
            motivo_baja: null,
            reopen_at: new Date(),
            comentario_cambio_estado_id: comment.id.value,
            reopen_by: uuidv4(),
            updated_at: new Date(),
        };

        await expect(kaseReopen.execute(kase.id.value, payload)).rejects.toThrow(CustomError);
    });

    it('should error when try reopen a non exist case', async () => {
        const kaseReopen = new CaseReopener(
            repository,
            groupsRepository,
            globalConfigurationRepository,
            commentRepository
        );
        const payload = {
            fecha_resolucion: null,
            motivo_baja: null,
            reopen_at: new Date(),
            comentario_cambio_estado_id: uuidv4(),
            reopen_by: uuidv4(),
            updated_at: new Date(),
        };

        await expect(kaseReopen.execute(uuidv4(), payload)).rejects.toThrow(CustomError);
    });

    it('should error when try reopen case outside configured window', async () => {
        const group = await createValidGroup();
        const kase = await CasesMother.createCase(repository, {
            fecha_resolucion: new Date(),
            grupo_id: group.id.value,
            created_at: new Date('2000-01-01T00:00:00.000Z'),
        });
        const kaseReopen = new CaseReopener(
            repository,
            groupsRepository,
            globalConfigurationRepository,
            commentRepository
        );

        const payload = {
            fecha_resolucion: null,
            motivo_baja: null,
            reopen_at: new Date(),
            comentario_cambio_estado_id: uuidv4(),
            reopen_by: uuidv4(),
            updated_at: new Date(),
        };

        await expect(kaseReopen.execute(kase.id.value, payload, { userGroupId: group.id.value })).rejects.toThrow(
            CustomError
        );
    });

    it('can fetch transitions of one created case', async () => {
        const transition = await createNamedTransition();
        const group = await createNamedGroup('Grupo created transition');
        const dto = CasesMother.dto({ transicion_id: transition.id.value, grupo_id: group.id });
        await CasesMother.ensureRelations(repository.connection, dto, {});
        await new CaseCreator(repository, actionExecutionServiceMock).execute(dto);

        const caseTransitions = new CaseTransitionsFinder(repository);

        const caseTransitionsResponse = await caseTransitions.execute(dto.id);

        expect(caseTransitionsResponse).toBeInstanceOf(CaseTransitionsResponse);
        expect(caseTransitionsResponse.toJson().data[0]).toMatchObject({
            actualizador: expect.any(String),
            fecha: expect.any(String),
            responsable: expect.any(Object),
            grupo: expect.any(String),
            estado_actual: expect.any(String),
            estado_siguiente: expect.any(String),
            fecha_resolucion: expect.any(String),
        });
    });

    it('can fetch transitions of one updated case', async () => {
        const dto = CasesMother.dto();
        await CasesMother.ensureRelations(repository.connection, dto, {});
        await new CaseCreator(repository, actionExecutionServiceMock).execute(dto);

        const caseUpdater = new CaseUpdater(repository, actionExecutionServiceMock, currentUser);
        const caseTransitions = new CaseTransitionsFinder(repository);
        const group = await createNamedGroup('Grupo updated transition');

        const updatedTransition = await createNamedTransition();

        const payload = {
            motivo_baja: 'Motivo baja updated transition',
            transicion_id: updatedTransition.id.value,
            updated_at: new Date(),
            grupo_id: group.id,
        };

        await caseUpdater.execute(dto.id, payload);

        const caseTransitionsResponse = await caseTransitions.execute(dto.id);
        const transitionsJson = caseTransitionsResponse.toJson().data;

        expect(caseTransitionsResponse).toBeInstanceOf(CaseTransitionsResponse);
        expect(transitionsJson.length).toEqual(2);
        expect(transitionsJson[0]).toMatchObject({
            actualizador: expect.any(String),
            fecha: expect.any(String),
            responsable: expect.any(Object),
            grupo: expect.any(String),
            estado_actual: expect.any(String),
            estado_siguiente: expect.any(String),
            fecha_resolucion: expect.any(String),
        });
    });

    it('can fetch transitions of one updated case with resolutionDate', async () => {
        const group = await createNamedGroup('Grupo resolution transition');
        const dto = CasesMother.dto({ grupo_id: group.id });
        await CasesMother.ensureRelations(repository.connection, dto, {});
        await new CaseCreator(repository, actionExecutionServiceMock).execute(dto);

        const caseUpdater = new CaseUpdater(repository, actionExecutionServiceMock, currentUser);
        const caseTransitions = new CaseTransitionsFinder(repository);

        const updatedTransition = await createNamedTransition();

        const payload = {
            motivo_baja: 'Motivo baja updated transition',
            transicion_id: updatedTransition.id.value,
            updated_at: new Date(),
            fecha_resolucion: new Date(),
        };

        await caseUpdater.execute(dto.id, payload);

        const caseTransitionsResponse = await caseTransitions.execute(dto.id);
        const transitionsJson = caseTransitionsResponse.toJson().data;

        expect(caseTransitionsResponse).toBeInstanceOf(CaseTransitionsResponse);
        expect(transitionsJson.length).toEqual(2);
        expect(transitionsJson[0]).toMatchObject({
            actualizador: expect.any(String),
            fecha: expect.any(String),
            responsable: expect.any(Object),
            grupo: expect.any(String),
            estado_actual: expect.any(String),
            estado_siguiente: expect.any(String),
            fecha_resolucion: expect.any(String),
        });
    });

    it('The initial creation record has a null transition_date', async () => {
        const dto = CasesMother.dto();
        await CasesMother.ensureRelations(repository.connection, dto, {});
        await new CaseCreator(repository, actionExecutionServiceMock).execute(dto);

        const caseTransitions = new CaseTransitionsFinder(repository);
        const response = await caseTransitions.execute(dto.id);
        const data = response.toJson().data;

        expect(response).toBeInstanceOf(CaseTransitionsResponse);
        expect(data.length).toBe(1);
        expect(data[0].fecha_transicion).toBeNull();
    });

    it('exposes transition_date with the exact date the transition was executed', async () => {
        const dto = CasesMother.dto();
        await CasesMother.ensureRelations(repository.connection, dto, {});
        await new CaseCreator(repository, actionExecutionServiceMock).execute(dto);

        const caseUpdater = new CaseUpdater(repository, actionExecutionServiceMock, currentUser);
        const caseTransitions = new CaseTransitionsFinder(repository);

        const before = new Date();
        const transicionId = uuidv4();
        await ensureParentRow(repository.connection, 'transiciones', transicionId);
        await caseUpdater.execute(dto.id, {
            transicion_id: transicionId,
            updated_at: new Date(),
        });
        const after = new Date();

        const response = await caseTransitions.execute(dto.id);
        const data = response.toJson().data;

        expect(response).toBeInstanceOf(CaseTransitionsResponse);
        expect(data.length).toBe(2);

        expect(data[0].fecha_transicion).not.toBeNull();
        const fechaCurrentState = new Date(data[0].fecha_transicion);
        expect(fechaCurrentState.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(fechaCurrentState.getTime()).toBeLessThanOrEqual(after.getTime());

        expect(data[1].fecha_transicion).toBeNull();
    });

    it('stores transition_date at the exact moment of each state change', async () => {
        const dto = CasesMother.dto();
        await CasesMother.ensureRelations(repository.connection, dto, {});
        await new CaseCreator(repository, actionExecutionServiceMock).execute(dto);

        const caseUpdater = new CaseUpdater(repository, actionExecutionServiceMock, currentUser);
        const caseTransitions = new CaseTransitionsFinder(repository);

        const fechaT1 = dayjs().subtract(3, 'second').toDate();
        const transicionId1 = uuidv4();
        await ensureParentRow(repository.connection, 'transiciones', transicionId1);
        await caseUpdater.execute(dto.id, { transicion_id: transicionId1, updated_at: fechaT1 });

        await new Promise((resolve) => setTimeout(resolve, 100));

        const fechaT2 = dayjs().subtract(2, 'second').toDate();
        const transicionId2 = uuidv4();
        await ensureParentRow(repository.connection, 'transiciones', transicionId2);
        await caseUpdater.execute(dto.id, { transicion_id: transicionId2, updated_at: fechaT2 });

        await new Promise((resolve) => setTimeout(resolve, 100));

        const fechaT3 = dayjs().subtract(1, 'second').toDate();
        const transicionId3 = uuidv4();
        await ensureParentRow(repository.connection, 'transiciones', transicionId3);
        await caseUpdater.execute(dto.id, { transicion_id: transicionId3, updated_at: fechaT3 });

        const response = await caseTransitions.execute(dto.id);
        const data = response.toJson().data;

        expect(data.length).toBe(4);

        const fechaData0 = new Date(data[0].fecha_transicion);
        const fechaData1 = new Date(data[1].fecha_transicion);
        const fechaData2 = new Date(data[2].fecha_transicion);

        expect(fechaData0.getTime()).toBe(fechaT3.getTime());
        expect(fechaData1.getTime()).toBe(fechaT2.getTime());
        expect(fechaData2.getTime()).toBe(fechaT1.getTime());

        expect(data[3].fecha_transicion).toBeNull();
    });

    it('registers a different transition_date for each sequential transition', async () => {
        const dto = CasesMother.dto();
        await CasesMother.ensureRelations(repository.connection, dto, {});
        await new CaseCreator(repository, actionExecutionServiceMock).execute(dto);

        const caseUpdater = new CaseUpdater(repository, actionExecutionServiceMock, currentUser);
        const caseTransitions = new CaseTransitionsFinder(repository);

        const beforeT1 = new Date();
        const transicionIdT1 = uuidv4();
        await ensureParentRow(repository.connection, 'transiciones', transicionIdT1);
        await caseUpdater.execute(dto.id, { transicion_id: transicionIdT1, updated_at: new Date() });
        const afterT1 = new Date();

        await new Promise((resolve) => setTimeout(resolve, 50));

        const beforeT2 = new Date();
        const transicionIdT2 = uuidv4();
        await ensureParentRow(repository.connection, 'transiciones', transicionIdT2);
        await caseUpdater.execute(dto.id, { transicion_id: transicionIdT2, updated_at: new Date() });
        const afterT2 = new Date();

        const response = await caseTransitions.execute(dto.id);
        const data = response.toJson().data;

        expect(data.length).toBe(3);

        expect(data[0].fecha_transicion).not.toBeNull();
        const fechaCurrentState = new Date(data[0].fecha_transicion);
        expect(fechaCurrentState.getTime()).toBeGreaterThanOrEqual(beforeT2.getTime());
        expect(fechaCurrentState.getTime()).toBeLessThanOrEqual(afterT2.getTime());

        const t2Entry = data[1];
        expect(t2Entry.fecha_transicion).not.toBeNull();
        const fechaT2 = new Date(t2Entry.fecha_transicion);
        expect(fechaT2.getTime()).toBeGreaterThanOrEqual(beforeT1.getTime());
        expect(fechaT2.getTime()).toBeLessThanOrEqual(afterT1.getTime());

        expect(data[2].fecha_transicion).toBeNull();
    });

    it('transition_date is not contaminated with updates to fields not related to the transition', async () => {
        const dto = CasesMother.dto();
        await CasesMother.ensureRelations(repository.connection, dto, {});
        await new CaseCreator(repository, actionExecutionServiceMock).execute(dto);

        const caseUpdater = new CaseUpdater(repository, actionExecutionServiceMock, currentUser);
        const caseTransitions = new CaseTransitionsFinder(repository);

        const beforeTransition = new Date();
        const transicionId = uuidv4();
        await ensureParentRow(repository.connection, 'transiciones', transicionId);
        await caseUpdater.execute(dto.id, { transicion_id: transicionId, updated_at: new Date() });
        const afterTransition = new Date();

        await new Promise((resolve) => setTimeout(resolve, 50));

        const laterUpdate = new Date();
        await caseUpdater.execute(dto.id, { motivo_baja: 'actualización intermedia', updated_at: laterUpdate });

        const response = await caseTransitions.execute(dto.id);
        const data = response.toJson().data;

        expect(data.length).toBe(2);

        expect(data[0].fecha_transicion).not.toBeNull();
        const fechaCurrentState = new Date(data[0].fecha_transicion);
        expect(fechaCurrentState.getTime()).toBeGreaterThanOrEqual(beforeTransition.getTime());
        expect(fechaCurrentState.getTime()).toBeLessThanOrEqual(afterTransition.getTime());
        expect(fechaCurrentState.getTime()).toBeLessThan(laterUpdate.getTime());

        expect(data[1].fecha_transicion).toBeNull();
    });

    it('exposes transicion_id in each transition entry of the response', async () => {
        const dto = CasesMother.dto();
        await CasesMother.ensureRelations(repository.connection, dto, {});
        await new CaseCreator(repository, actionExecutionServiceMock).execute(dto);

        const newTransicionId = uuidv4();
        await ensureParentRow(repository.connection, 'transiciones', newTransicionId);
        const caseUpdater = new CaseUpdater(repository, actionExecutionServiceMock, currentUser);
        const caseTransitions = new CaseTransitionsFinder(repository);

        await caseUpdater.execute(dto.id, {
            transicion_id: newTransicionId,
            updated_at: new Date(),
        });

        const response = await caseTransitions.execute(dto.id);
        const data = response.toJson().data;

        expect(response).toBeInstanceOf(CaseTransitionsResponse);
        expect(data.length).toBe(2);
        expect(data[0].transicion_id).toBe(newTransicionId);
        expect(data[1].transicion_id).toBe(dto.transicion_id);
    });

    it('actualizador shows who executed each consecutive state transition correctly', async () => {
        const userA = await UsersMother.createUser(usersRepository);
        const userB = await UsersMother.createUser(usersRepository);

        const dto = CasesMother.dto();
        await CasesMother.ensureRelations(repository.connection, dto, {});
        await new CaseCreator(repository, actionExecutionServiceMock).execute(dto);

        const caseUpdater = new CaseUpdater(repository, actionExecutionServiceMock, currentUser);

        const transicionIdA = uuidv4();
        await ensureParentRow(repository.connection, 'transiciones', transicionIdA);
        await caseUpdater.execute(dto.id, {
            transicion_id: transicionIdA,
            updated_at: new Date(),
            updated_by: userA.id.value,
        });

        const transicionIdB = uuidv4();
        await ensureParentRow(repository.connection, 'transiciones', transicionIdB);
        await caseUpdater.execute(dto.id, {
            transicion_id: transicionIdB,
            updated_at: new Date(),
            updated_by: userB.id.value,
        });

        const caseTransitions = new CaseTransitionsFinder(repository);
        const response = await caseTransitions.execute(dto.id);
        const data = response.toJson().data;

        expect(data.length).toBe(3);

        const userALogin = userA.login.value;
        const userBLogin = userB.login.value;

        expect(data[0].actualizador).toBe(userBLogin);
        expect(data[1].actualizador).toBe(userALogin);
    });

    it('can delete a exist open case', async () => {
        const kase = await CasesMother.createCase(repository);
        const kasedeleter = new CaseDeleter(repository);

        await kasedeleter.execute(kase.id.value);

        const casedeleted = await repository.connection('cases').first('*').where({ id: kase.id.value });
        expect(casedeleted.deleted_at).not.toBeNull();
    });

    it('should return an error when try to create a case with an existing id', async () => {
        const kase = await CasesMother.createCase(repository);
        const caseCreator = new CaseCreator(repository, null);

        await expect(caseCreator.execute(kase.toJson())).rejects.toThrow(ValidationFailError);
    });

    it('should create case whit external code', async () => {
        const dto = CasesMother.dto({ external_code: 'ABC123' });
        await CasesMother.ensureRelations(repository.connection, dto, { external_code: dto.external_code });
        const kase = await new CaseCreator(repository, actionExecutionServiceMock).execute(dto);

        const kaseResponse = kase.toJson();

        expect(kaseResponse.data.external_code).toBe('ABC123');
    });

    it('Must order cases with nested auxiliaries values "asc"', async () => {
        const globalConfig = await GlobalConfigurationsMother.createWorkQueueAuxConfig(globalConfigurationRepository);

        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository, {
            configuration_id: globalConfig.id.value,
        });

        for (let cicle = 0; cicle < 2; cicle++) {
            const kace = await CasesMother.createCase(repository, { grupo_id: group.id.value });
            const auxOverrides = {
                caso_id: kace.id.value,
                data: {
                    form_vida_salud: {
                        vencimiento: cicle,
                    },
                },
            };
            await AuxCasesMother.createAuxCase(auxCaseRepository, auxOverrides);
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // `findAllMatchingCondition` solo emite ORDER BY si recibe `work_queue_sorting_rules`:
        // la configuracion del grupo no llega hasta el repositorio. Sin reglas postgres
        // devuelve las dos filas en orden arbitrario y la asercion era una moneda al aire.
        // Se pasan las reglas explicitas y se filtra por grupo, igual que ya hace la variante
        // "desc" de este mismo bloque (que por eso nunca oscilo).
        const find = await repository.findAllMatchingCondition(
            { 'cases.fecha_resolucion': null, 'cases.grupo_id': group.id.value },
            {
                work_queue_sorting_rules: [
                    {
                        assign_strategy: 'aux_cases.form_vida_salud.vencimiento',
                        order_type: 'ASC',
                        cast_type: 'int',
                    },
                ],
            }
        );

        expect(new Date(find[0].created_at.value).getTime()).toBeLessThan(new Date(find[1].created_at.value).getTime());
    });

    it('find a correct case whit especific matching condition "desc" (KnexCaseRepository.findAllMatchingCondition)', async () => {
        const globalConfig = await GlobalConfigurationsMother.createWorkQueueAuxConfig(globalConfigurationRepository);
        const newSettings = globalConfig.settings.value;
        newSettings.behaviors.application.agente.casos.assign_strategy = 'state_change_at';
        newSettings.behaviors.application.agente.casos.order_type = 'desc';

        globalConfig.settings = newSettings;
        await globalConfigurationRepository.update(globalConfig);

        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository, {
            configuration_id: globalConfig.id.value,
        });

        const now = new Date();
        const created_at = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const state_change_at = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

        const overrides = {
            created_at,
            state_change_at,
            grupo_id: group.id.value,
        };

        for (let cicle = 0; cicle < 2; cicle++) {
            await CasesMother.createCase(repository, cicle === 0 ? overrides : {});
        }

        // El `assign_strategy`/`order_type` que este test escribe en la configuracion global
        // no viaja hasta el repositorio: `findAllMatchingCondition` solo ordena por lo que le
        // llega en `work_queue_sorting_rules`. Sin reglas no hay ORDER BY y el orden de filas
        // que devolvia postgres decidia el resultado. Se pasan aqui las mismas reglas que
        // describe la configuracion para que el test compruebe de verdad el "desc".
        const find = await repository.findAllMatchingCondition(
            { 'cases.fecha_resolucion': null },
            {
                work_queue_sorting_rules: [{ assign_strategy: 'state_change_at', order_type: 'desc' }],
            }
        );

        expect(new Date(find[0].state_change_at.value).getTime()).toBeGreaterThan(
            new Date(find[1].state_change_at.value).getTime()
        );
    });

    it('should return cases sorted by state_change_at ASC when assign_strategy is state_change_at', async () => {
        // Arrange - Configure work queue with state_change_at strategy in ascending order
        const globalConfig = await GlobalConfigurationsMother.createWorkQueueAuxConfig(globalConfigurationRepository);
        const newSettings = globalConfig.settings.value;
        newSettings.behaviors.application.agente.casos.assign_strategy = 'state_change_at';
        newSettings.behaviors.application.agente.casos.order_type = 'asc';
        globalConfig.settings = newSettings;
        await globalConfigurationRepository.update(globalConfig);

        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository, {
            configuration_id: globalConfig.id.value,
        });

        const olderCaseOverrides = {
            created_at: dayjs().subtract(10, 'day').toISOString(),
            state_change_at: dayjs().subtract(8, 'day').toISOString(),
            grupo_id: group.id.value,
        };

        await CasesMother.createCase(repository, olderCaseOverrides);
        await CasesMother.createCase(repository, { grupo_id: group.id.value });

        // Act - Find unresolved cases.
        // Las reglas de orden van explicitas: el repositorio no lee la configuracion global
        // del grupo, asi que sin `work_queue_sorting_rules` la consulta sale sin ORDER BY y
        // el orden de filas de postgres decidia si el test pasaba. Ambos casos comparten
        // grupo, por eso se puede filtrar por el sin perder ninguna fila sembrada.
        const cases = await repository.findAllMatchingCondition(
            { 'cases.fecha_resolucion': null, 'cases.grupo_id': group.id.value },
            {
                work_queue_sorting_rules: [{ assign_strategy: 'state_change_at', order_type: 'asc' }],
            }
        );

        // Assert - In ASC order, first case should have the oldest state_change_at
        const firstCaseStateChange = new Date(cases[0].state_change_at.value).getTime();
        const secondCaseStateChange = new Date(cases[1].state_change_at.value).getTime();
        expect(secondCaseStateChange).toBeGreaterThan(firstCaseStateChange);
    });

    it('find a correct case whit especific matching condition case auxiliary "asc" (KnexCaseRepository.findAllMatchingCondition)', async () => {
        // Arrange - Configure work queue with state_change_at strategy in ascending order
        const globalConfig = await GlobalConfigurationsMother.createWorkQueueAuxConfig(globalConfigurationRepository);
        const newSettings = globalConfig.settings.value;
        newSettings.behaviors.application.agente.casos.assign_strategy = 'aux_cases.fecha_solicitud';
        newSettings.behaviors.application.agente.casos.order_type = 'asc';
        globalConfig.settings = newSettings;
        await globalConfigurationRepository.update(globalConfig);

        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository, {
            configuration_id: globalConfig.id.value,
        });

        const created_at = dayjs().subtract(7, 'day').toISOString();

        const overrides = {
            created_at,
            grupo_id: group.id.value,
        };

        for (let cicle = 0; cicle < 2; cicle++) {
            const kace = await CasesMother.createCase(repository, cicle === 0 ? overrides : {});
            const auxOverrides = {
                caso_id: kace.id.value,
                data: {
                    fecha_solicitud: kace.created_at.value,
                },
            };
            await AuxCasesMother.createAuxCase(auxCaseRepository, auxOverrides);
        }

        // Sin `work_queue_sorting_rules` la consulta no lleva ORDER BY y postgres devolvia
        // las dos filas en el orden que le convenia, asi que el "asc" del titulo no se
        // comprobaba: se pasa la regla que describe la configuracion global de arriba.
        // Los dos casos tienen `fecha_solicitud` distinta (-7d y el valor por defecto del
        // mother, -6d), asi que no hay empate que desempatar.
        const find = await repository.findAllMatchingCondition(
            { 'cases.fecha_resolucion': null },
            {
                work_queue_sorting_rules: [
                    { assign_strategy: 'aux_cases.fecha_solicitud', order_type: 'asc', cast_type: 'date' },
                ],
            }
        );

        expect(new Date(find[1].created_at.value).getTime()).toBeGreaterThan(
            new Date(find[0].created_at.value).getTime()
        );
    });

    it('find a correct case whit especific matching condition case auxiliary "desc" (KnexCaseRepository.findAllMatchingCondition)', async () => {
        // Arrange - Configure work queue with state_change_at strategy in ascending order
        const globalConfig = await GlobalConfigurationsMother.createWorkQueueAuxConfig(globalConfigurationRepository);
        const newSettings = globalConfig.settings.value;
        newSettings.behaviors.application.agente.casos.assign_strategy = 'aux_cases.fecha_solicitud';
        newSettings.behaviors.application.agente.casos.order_type = 'desc';
        globalConfig.settings = newSettings;
        await globalConfigurationRepository.update(globalConfig);

        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository, {
            configuration_id: globalConfig.id.value,
        });

        const now = new Date();
        const created_at = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();

        const overrides = {
            created_at,
            grupo_id: group.id.value,
        };

        for (let cicle = 0; cicle < 2; cicle++) {
            const kace = await CasesMother.createCase(repository, cicle === 0 ? overrides : {});
            const auxOverrides = {
                caso_id: kace.id.value,
                data: {
                    fecha_solicitud: kace.created_at.value,
                },
            };
            await AuxCasesMother.createAuxCase(auxCaseRepository, auxOverrides);
        }

        // Mismo motivo que en la variante "asc": la regla de orden tiene que llegar al
        // repositorio o la consulta sale sin ORDER BY y el resultado depende del orden
        // fisico de las filas. Las dos `fecha_solicitud` sembradas son distintas (-5d y el
        // -6d por defecto del mother), asi que el desempate no hace falta.
        const find = await repository.findAllMatchingCondition(
            { 'cases.fecha_resolucion': null },
            {
                work_queue_sorting_rules: [
                    { assign_strategy: 'aux_cases.fecha_solicitud', order_type: 'desc', cast_type: 'date' },
                ],
            }
        );

        expect(new Date(find[0].created_at.value).getTime()).toBeGreaterThan(
            new Date(find[1].created_at.value).getTime()
        );
    });

    it('Must order cases with nested auxiliaries values "desc"', async () => {
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        for (let cicle = 0; cicle < 2; cicle++) {
            const kace = await CasesMother.createCase(repository, { grupo_id: group.id.value });
            const auxOverrides = {
                caso_id: kace.id.value,
                data: {
                    form_vida_salud: {
                        vencimiento: cicle,
                    },
                },
            };
            await AuxCasesMother.createAuxCase(auxCaseRepository, auxOverrides);
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const find = await repository.findAllMatchingCondition(
            { 'cases.fecha_resolucion': null, 'cases.grupo_id': group.id.value },
            {
                work_queue_sorting_rules: [
                    {
                        assign_strategy: 'aux_cases.form_vida_salud.vencimiento',
                        order_type: 'DESC',
                        cast_type: 'int',
                    },
                ],
            }
        );

        expect(new Date(find[0].created_at.value).getTime()).toBeGreaterThan(
            new Date(find[1].created_at.value).getTime()
        );
    });

    it('supports work_queue_sorting_rules with sequential ordering and ASC NULLS FIRST', async () => {
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        const nullSlaCase = await CasesMother.createCase(repository, {
            grupo_id: group.id.value,
            created_at: '2030-01-03T10:00:00.000Z',
            sla_due_date: null,
        });
        const tieA = await CasesMother.createCase(repository, {
            grupo_id: group.id.value,
            created_at: '2030-01-01T10:00:00.000Z',
            sla_due_date: '2030-01-05T10:00:00.000Z',
        });
        const tieB = await CasesMother.createCase(repository, {
            grupo_id: group.id.value,
            created_at: '2030-01-02T10:00:00.000Z',
            sla_due_date: '2030-01-05T10:00:00.000Z',
        });

        const find = await repository.findAllMatchingCondition(
            {
                'cases.fecha_resolucion': null,
                'cases.grupo_id': group.id.value,
            },
            {
                work_queue_sorting_rules: [
                    {
                        assign_strategy: 'sla_due_date',
                        order_type: 'ASC NULLS FIRST',
                        cast_type: 'date',
                    },
                    {
                        assign_strategy: 'created_at',
                        order_type: 'ASC',
                    },
                ],
            }
        );

        expect(find.map((item) => item.id.value)).toEqual([nullSlaCase.id.value, tieA.id.value, tieB.id.value]);
    });

    it('supports mixed aux_cases and created_at sorting rules without ambiguous columns', async () => {
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        const tieA = await CasesMother.createCase(repository, {
            grupo_id: group.id.value,
            created_at: '2030-01-01T10:00:00.000Z',
        });
        const tieB = await CasesMother.createCase(repository, {
            grupo_id: group.id.value,
            created_at: '2030-01-02T10:00:00.000Z',
        });
        const laterAuxValue = await CasesMother.createCase(repository, {
            grupo_id: group.id.value,
            created_at: '2030-01-03T10:00:00.000Z',
        });

        await AuxCasesMother.createAuxCase(auxCaseRepository, {
            caso_id: tieA.id.value,
            data: { fecha_solicitud: '2030-01-05T10:00:00.000Z' },
        });
        await AuxCasesMother.createAuxCase(auxCaseRepository, {
            caso_id: tieB.id.value,
            data: { fecha_solicitud: '2030-01-05T10:00:00.000Z' },
        });
        await AuxCasesMother.createAuxCase(auxCaseRepository, {
            caso_id: laterAuxValue.id.value,
            data: { fecha_solicitud: '2030-01-06T10:00:00.000Z' },
        });

        const find = await repository.findAllMatchingCondition(
            {
                'cases.fecha_resolucion': null,
                'cases.grupo_id': group.id.value,
            },
            {
                work_queue_sorting_rules: [
                    {
                        assign_strategy: 'aux_cases.fecha_solicitud',
                        order_type: 'ASC',
                        cast_type: 'date',
                    },
                    {
                        assign_strategy: 'created_at',
                        order_type: 'ASC',
                    },
                ],
            }
        );

        expect(find.map((item) => item.id.value)).toEqual([tieA.id.value, tieB.id.value, laterAuxValue.id.value]);
    });

    it('supports single-rule ordering with work_queue_sorting_rules array', async () => {
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        const low = await CasesMother.createCase(repository, {
            grupo_id: group.id.value,
            ans_posicion: 1,
        });
        const high = await CasesMother.createCase(repository, {
            grupo_id: group.id.value,
            ans_posicion: 9,
        });

        const find = await repository.findAllMatchingCondition(
            {
                'cases.fecha_resolucion': null,
                'cases.grupo_id': group.id.value,
            },
            {
                work_queue_sorting_rules: [
                    {
                        assign_strategy: 'ans_posicion',
                        order_type: 'DESC',
                        cast_type: 'int',
                    },
                ],
            }
        );

        expect(find[0].id.value).toBe(high.id.value);
        expect(find[1].id.value).toBe(low.id.value);
    });

    it('should log a state change when transicion_id is updated', async () => {
        const kase = await CasesMother.createCase(repository);
        const caseUpdater = new CaseUpdater(repository, actionExecutionServiceMock, currentUser);

        const newTransitionId = uuidv4();
        await ensureParentRow(repository.connection, 'transiciones', newTransitionId);

        await caseUpdater.execute(kase.id.value, {
            transicion_id: newTransitionId,
            updated_at: new Date(),
            updated_by: currentUser.id.value,
        });

        const eventLog = await repository
            .connection('event_logs')
            .where({ aggregate_id: kase.id.value, event_name: 'case.state_changed' })
            .first();

        expect(eventLog).toBeDefined();
        expect(eventLog.aggregate_id).toBe(kase.id.value);
        expect(eventLog.event_name).toBe('case.state_changed');

        const payload = eventLog.body;
        expect(payload.transicion_id).toBe(newTransitionId);
    });

    it('should log a responsible change when responsable_id is updated', async () => {
        const kase = await CasesMother.createCase(repository);
        const caseUpdater = new CaseUpdater(repository, actionExecutionServiceMock, currentUser);

        const newResponsibleId = uuidv4();
        await ensureParentRow(repository.connection, 'usuarios', newResponsibleId);

        await caseUpdater.execute(kase.id.value, {
            responsable_id: newResponsibleId,
            updated_at: new Date(),
            updated_by: currentUser.id.value,
        });

        const eventLog = await repository
            .connection('event_logs')
            .where({ aggregate_id: kase.id.value, event_name: 'case.responsible_changed' })
            .first();

        expect(eventLog).toBeDefined();
        expect(eventLog.event_name).toBe('case.responsible_changed');

        const payload = eventLog.body;
        expect(payload.responsable_id).toBe(newResponsibleId);
    });

    it('should calculate SLA fields asynchronously after case creation', async () => {
        const transitionAns = await AnsMother.createAns(ansRepository, {
            intermedio: 2,
            vancido: 4,
            medicion_ans_id: Types.HOURS.value,
        });
        const transitions = await TransitionsMother.createRandomTransition(transitionRepository, {
            ans_id: transitionAns.id.value,
        });

        const ans = await AnsMother.createAns(ansRepository, {
            intermedio: 1,
            vancido: 2,
            medicion_ans_id: Types.DAYS.value,
        });
        const classification = await ClassificationsMother.create(classificationRepository, {
            ans_id: ans.id.value,
        });

        const shifts = ShiftManagementMother.dto();
        const shiftManagement = await ShiftManagementMother.createShiftManagement(shiftManagementRepository, {
            holiday_dates: shifts.holiday_dates,
            work_days: shifts.work_days,
        });

        const group = await GroupsMother.createWithCustomShiftManagement(groupsRepository, shiftManagement);

        const caseOverrides = {
            transicion_id: transitions.id.value,
            clasificacion_id: classification.id.value,
            work_days: shifts.work_days,
            holiday_dates: shifts.holiday_dates,
            grupo_id: group.id.value,
        };
        const dto = CasesMother.dto(caseOverrides);
        await CasesMother.ensureRelations(repository.connection, dto, caseOverrides);

        await new CaseCreator(repository).execute(dto);

        // SLA timers are intentionally NOT computed synchronously by CaseCreator anymore:
        // they are written asynchronously by ExecuteActionsOnCaseCreated when the
        // kace.core.case.created event is consumed. The freshly created row therefore has
        // empty SLA fields until that async handler runs.
        const createdRow = await repository.connection('cases').where({ id: dto.id });
        expect(createdRow[0].antiguedad).toBeFalsy();
        expect(createdRow[0].expired_at).toBeFalsy();

        // Exercise the same async path the event_processor runs: ExecuteActionsOnCaseCreated.handle
        // computes the action triggers (no-op here via the mock) and then updates the SLA timers
        // (executeForAns -> UpdateSLATimers -> repository.update -> repository.saveHistory).
        const handler = new ExecuteActionsOnCaseCreated(repository, actionExecutionServiceMock);
        await handler.handle({ aggregateId: dto.id });

        const kaceResult = await repository.connection('cases').where({ id: dto.id });

        expect(kaceResult[0].sla_id).toBe(dto.sla_id);
        expect(kaceResult[0].sla_state_id).toBe(dto.sla_state_id);

        expect(typeof kaceResult[0].antiguedad).toBe('string');
        expect(typeof kaceResult[0].ans_posicion).toBe('number');
        expect(typeof kaceResult[0].antiguedad_dias).toBe('number');
        expect(typeof kaceResult[0].antiguedad_horas).toBe('number');
        expect(typeof kaceResult[0].antiguedad_minutos).toBe('number');

        expect(typeof kaceResult[0].state_elapsed_time).toBe('string');
        expect(typeof kaceResult[0].state_elapsed_days).toBe('number');
        expect(typeof kaceResult[0].state_elapsed_hours).toBe('number');
        expect(typeof kaceResult[0].state_elapsed_minutes).toBe('number');

        // `expired_at` es una columna timestamp: el driver de pg la devuelve como Date, no como
        // cadena. `remaining_time` si es texto.
        expect(kaceResult[0].expired_at).toBeInstanceOf(Date);
        expect(typeof kaceResult[0].remaining_time).toBe('string');

        expect(typeof kaceResult[0].sla_position).toBe('number');
        expect(typeof kaceResult[0].sla_elapsed_time).toBe('string');
        expect(typeof kaceResult[0].sla_elapsed_days).toBe('number');
        expect(typeof kaceResult[0].sla_elapsed_hours).toBe('number');
        expect(typeof kaceResult[0].sla_elapsed_minutes).toBe('number');

        expect(typeof kaceResult[0].sla_state_position).toBe('number');
        expect(typeof kaceResult[0].sla_state_elapsed_time).toBe('string');
        expect(typeof kaceResult[0].sla_state_elapsed_days).toBe('number');
        expect(typeof kaceResult[0].sla_state_elapsed_hours).toBe('number');
        expect(typeof kaceResult[0].sla_state_elapsed_minutes).toBe('number');

        // Igual que expired_at: `sla_due_date` es timestamp y llega como Date.
        expect(kaceResult[0].sla_due_date).toBeInstanceOf(Date);
        expect(typeof kaceResult[0].sla_remaining_time).toBe('string');
        expect(typeof kaceResult[0].sla_remaining_days).toBe('number');
        expect(typeof kaceResult[0].sla_remaining_hours).toBe('number');
        expect(typeof kaceResult[0].sla_remaining_minutes).toBe('number');

        // Igual que expired_at y sla_due_date: es timestamp y llega como Date.
        expect(kaceResult[0].sla_state_due_date).toBeInstanceOf(Date);
        expect(typeof kaceResult[0].sla_state_remaining_time).toBe('string');
        expect(typeof kaceResult[0].sla_state_remaining_days).toBe('number');
        expect(typeof kaceResult[0].sla_state_remaining_hours).toBe('number');
        expect(typeof kaceResult[0].sla_state_remaining_minutes).toBe('number');
    });

    it('should NOT close a case when it has at least one OPEN child and allow_close_case_without_subcases=false', async () => {
        const config = await GlobalConfigurationsMother.createWorkQueueAuxConfig(globalConfigurationRepository, {
            behaviors: { application: { agente: { casos: { allow_close_case_without_subcases: false } } } },
        });

        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository, {
            configuration_id: config.id.value,
        });

        const parent = await CasesMother.createCase(repository, { grupo_id: group.id.value });
        const child = await CasesMother.createCase(repository, { grupo_id: group.id.value });

        await repository.connection('rel_cases_subcases').insert({
            parent_case_id: parent.id.value,
            child_case_id: child.id.value,
        });

        const caseCloser = new CaseCloser(
            repository,
            groupsRepository,
            globalConfigurationRepository,
            subcaseRelationshipRepository
        );

        await expect(caseCloser.execute(parent.id.value)).rejects.toThrow(
            'The case cannot be closed: it has open subcases, and the group configuration prohibits it.'
        );

        const stillOpen = await repository.connection('cases').first('*').where({ id: parent.id.value });

        expect(stillOpen.fecha_resolucion).toBeNull();
    });

    it('can close a exist open case', async () => {
        const group = await createValidGroup();
        const kase = await CasesMother.createCase(repository, { grupo_id: group.id.value });

        const kaseCloser = new CaseCloser(
            repository,
            groupsRepository,
            globalConfigurationRepository,
            subcaseRelationshipRepository
        );

        await kaseCloser.execute(kase.id.value, {
            update_source: 'manual',
        });

        const caseClosed = await repository.connection('cases').first('*').where({ id: kase.id.value });

        expect(caseClosed.fecha_resolucion).not.toBeNull();
        expect(caseClosed.update_source).toBe('manual');
    });

    it('can update an existing case with all attributes with update_source', async () => {
        const kase = await CasesMother.createCase(repository);
        const caseUpdater = new CaseUpdater(repository, actionExecutionServiceMock, currentUser);
        let parent_id = uuidv4();
        const descripcionCasoId = uuidv4();
        await ensureParentRow(repository.connection, 'descripciones_casos', descripcionCasoId);

        const payload = {
            cliente_id: kase.cliente_id.value,
            transicion_id: kase.transicion_id.value,
            responsable_id: kase.responsable_id.value,
            clasificacion_id: kase.clasificacion_id.value,
            descripcion_caso_id: descripcionCasoId,
            grupo_id: kase.grupo_id.value,
            created_at: new Date().toISOString(),
            motivo_baja: 'motivo baja',
            alto_impacto: 0,
            vista: 'vistan update',
            created_by: uuidv4(),
            fecha_resolucion: new Date().toISOString(),
            antiguedad: 'new antiguedad',
            // References the case itself: caso_clonado_id only needs to point at an existing
            // row, and reusing kase.id avoids inserting an extra bare-bones row into `cases`
            // that would pollute later order-sensitive queries sharing this file's database.
            caso_clonado_id: kase.id.value,
            canal_id: 12,
            ans_posicion: 2,
            antiguedad_dias: 2,
            antiguedad_horas: 2,
            antiguedad_minutos: 2,
            cambio_estado_comentario_id: uuidv4(),
            cloned_by: uuidv4(),
            cloned_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            parent_id,
            update_source: 'bulk',
        };

        await caseUpdater.execute(kase.id.value, payload);
        const updatedCase = await repository.connection('cases').first('*').where({ id: kase.id.value });
        expect(updatedCase.antiguedad).toBe('new antiguedad');
        expect(updatedCase.update_source).toBe('bulk');
    });

    it('should fail if update_source is not bulk or manual', async () => {
        const kase = await CasesMother.createCase(repository);
        const caseUpdater = new CaseUpdater(repository, actionExecutionServiceMock, currentUser);
        const parent_id = uuidv4();

        const payload = {
            cliente_id: kase.cliente_id.value,
            transicion_id: kase.transicion_id.value,
            responsable_id: kase.responsable_id.value,
            clasificacion_id: kase.clasificacion_id.value,
            descripcion_caso_id: uuidv4(),
            grupo_id: kase.grupo_id.value,
            created_at: new Date().toISOString(),
            motivo_baja: 'motivo baja',
            alto_impacto: 0,
            vista: 'vistan update',
            created_by: uuidv4(),
            fecha_resolucion: new Date().toISOString(),
            antiguedad: 'new antiguedad',
            caso_clonado_id: uuidv4(),
            canal_id: 12,
            ans_posicion: 2,
            antiguedad_dias: 2,
            antiguedad_horas: 2,
            antiguedad_minutos: 2,
            cambio_estado_comentario_id: uuidv4(),
            cloned_by: uuidv4(),
            cloned_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            parent_id,
            update_source: 'cosa',
        };

        await expect(caseUpdater.execute(kase.id.value, payload)).rejects.toThrow(
            "updateSource must be 'bulk' or 'manual'"
        );
    });

    describe('Event Logging', () => {
        it('should log an event when a case is closed', async () => {
            const group = await createValidGroup();
            const kase = await CasesMother.createCase(repository, { grupo_id: group.id.value });
            const caseCloser = new CaseCloser(
                repository,
                groupsRepository,
                globalConfigurationRepository,
                subcaseRelationshipRepository
            );

            const state = await StateMother.createState(stateRepository);
            const transition = await TransitionsMother.createTransition(transitionRepository, null, null, state);

            const updatePayload = {
                transicion_id: transition.id.value,
                updated_by: currentUser.id.value,
                updated_at: new Date(),
            };

            await caseCloser.execute(kase.id.value, updatePayload);

            const eventLog = await repository
                .connection('event_logs')
                .where({ aggregate_id: kase.id.value, event_name: 'case.closed' })
                .first();

            expect(eventLog).toBeDefined();
            expect(eventLog.aggregate_id).toBe(kase.id.value);
            expect(eventLog.event_name).toBe('case.closed');

            const body = eventLog.body;

            expect(body.fecha_resolucion).toBeDefined();
            expect(body.updated_by).toBe(currentUser.id.value);
            expect(body.state).toBeDefined();
            expect(body.state.nombre).toEqual(state.nombre.value);
        });

        it('should log an event when a case is viewed', async () => {
            const state = await StateMother.createState(stateRepository);
            const transition = await TransitionsMother.createTransition(transitionRepository, null, null, state);
            const kase = await CasesMother.createCase(repository, { transicion_id: transition.id.value });
            const caseFinder = new CaseFinder(repository, currentUser);

            await caseFinder.execute(kase.id.value);

            const eventLog = await repository
                .connection('event_logs')
                .where({ aggregate_id: kase.id.value, event_name: 'case.viewed' })
                .first();

            expect(eventLog).toBeDefined();
            expect(eventLog.event_name).toBe('case.viewed');

            const body = eventLog.body;
            expect(body.state).toBeDefined();
            expect(body.state.nombre).toEqual(state.nombre.value);
        });

        it('should log detailed state change info', async () => {
            await usersRepository.save(currentUser);
            const state = await StateMother.createRandomState(stateRepository);
            const transition = await TransitionsMother.createTransition(transitionRepository, null, null, state);
            const kase = await CasesMother.createCase(repository, { transicion_id: transition.id.value });
            const caseUpdater = new CaseUpdater(repository, actionExecutionServiceMock, currentUser);

            const newState = await StateMother.createRandomState(stateRepository);
            const newTransition = await TransitionsMother.createTransition(transitionRepository, null, null, newState);

            await caseUpdater.execute(kase.id.value, {
                transicion_id: newTransition.id.value,
                updated_at: new Date(),
                updated_by: currentUser.id.value,
            });

            const eventLog = await repository
                .connection('event_logs')
                .where({ aggregate_id: kase.id.value, event_name: 'case.state_changed' })
                .first();

            const body = eventLog.body;
            const oldData = eventLog.old_data;
            expect(body.initiator).toBeDefined();
            expect(body.initiator.nombres).toBe(currentUser.nombres.value);
            expect(oldData.state).toBeDefined();
            expect(oldData.state.nombre).toBe(state.nombre.value);
            expect(body.state).toBeDefined();
        });

        it('should log an event when a when responsible assignment', async () => {
            const user = await UsersMother.createUser(usersRepository, { nombres: 'Old Responsible' });
            const kase = await CasesMother.createCase(repository, { responsable_id: user.id.value });
            const caseUpdater = new CaseUpdater(repository, actionExecutionServiceMock, currentUser);

            const newResponsible = await UsersMother.createUser(usersRepository);
            await caseUpdater.execute(kase.id.value, {
                responsable_id: newResponsible.id.value,
                updated_at: new Date(),
                updated_by: currentUser.id.value,
            });

            const eventLog = await repository
                .connection('event_logs')
                .where({ aggregate_id: kase.id.value, event_name: 'case.responsible_changed' })
                .first();

            const body = eventLog.body;
            expect(body.responsable).toBeDefined();
            expect(body.responsable.nombres).toBe(newResponsible.nombres.value);

            const oldData = eventLog.old_data;
            expect(oldData.responsable).toBeDefined();
            expect(oldData.responsable.nombres).toBe(user.nombres.value);
            expect(oldData.state).toBeDefined();
        });

        it('should log an event when a case is updated', async () => {
            const kase = await CasesMother.createCase(repository);
            const caseUpdater = new CaseUpdater(repository, actionExecutionServiceMock, currentUser);

            const newAntiguedad = 'updated value';

            await caseUpdater.execute(kase.id.value, {
                antiguedad: newAntiguedad,
                updated_at: new Date(),
                updated_by: currentUser.id.value,
            });

            const eventLog = await repository
                .connection('event_logs')
                .where({ aggregate_id: kase.id.value, event_name: 'case.updated' })
                .first();

            expect(eventLog).toBeDefined();

            const body = eventLog.body;
            expect(body.updated_by).toBe(currentUser.id.value);
            expect(body.antiguedad).toBe(newAntiguedad);
        });
    });

    describe('SLA Updates on Case Update', () => {
        it('should update SLA fields when case is updated', async () => {
            const transitionAns = await AnsMother.createAns(ansRepository, {
                intermedio: 2,
                vancido: 4,
                medicion_ans_id: Types.HOURS.value,
            });
            const transitions = await TransitionsMother.createRandomTransition(transitionRepository, {
                ans_id: transitionAns.id.value,
            });

            const ans = await AnsMother.createAns(ansRepository, {
                intermedio: 1,
                vancido: 2,
                medicion_ans_id: Types.DAYS.value,
            });
            const classification = await ClassificationsMother.create(classificationRepository, {
                ans_id: ans.id.value,
            });

            const shifts = ShiftManagementMother.dto();
            const shiftManagement = await ShiftManagementMother.createShiftManagement(shiftManagementRepository, {
                holiday_dates: shifts.holiday_dates,
                work_days: shifts.work_days,
            });

            const group = await GroupsMother.createWithCustomShiftManagement(groupsRepository, shiftManagement);

            const kase = await CasesMother.createCase(repository, {
                transicion_id: transitions.id.value,
                clasificacion_id: classification.id.value,
                grupo_id: group.id.value,
                ans_posicion: 1,
            });

            const originalCase = await repository.connection('cases').where({ id: kase.id.value }).first();

            await new Promise((resolve) => setTimeout(resolve, 100));

            const caseUpdater = new CaseUpdater(repository, actionExecutionServiceMock, currentUser);
            await caseUpdater.execute(kase.id.value, {
                motivo_baja: 'test update',
                updated_at: new Date(),
                updated_by: currentUser.id.value,
            });

            const updatedCase = await repository.connection('cases').where({ id: kase.id.value }).first();

            expect(typeof updatedCase.antiguedad).toBe('string');
            expect(typeof updatedCase.ans_posicion).toBe('number');
            expect(typeof updatedCase.antiguedad_dias).toBe('number');
            expect(typeof updatedCase.antiguedad_horas).toBe('number');
            expect(typeof updatedCase.antiguedad_minutos).toBe('number');

            expect(typeof updatedCase.state_elapsed_time).toBe('string');
            expect(typeof updatedCase.state_elapsed_days).toBe('number');
            expect(typeof updatedCase.state_elapsed_hours).toBe('number');
            expect(typeof updatedCase.state_elapsed_minutes).toBe('number');

            expect(typeof updatedCase.sla_position).toBe('number');
            expect(typeof updatedCase.sla_elapsed_time).toBe('string');
            expect(typeof updatedCase.sla_elapsed_days).toBe('number');
            expect(typeof updatedCase.sla_elapsed_hours).toBe('number');
            expect(typeof updatedCase.sla_elapsed_minutes).toBe('number');

            // `sla_due_date` es timestamp: pg lo devuelve como Date.
            expect(updatedCase.sla_due_date).toBeInstanceOf(Date);
            expect(typeof updatedCase.sla_remaining_time).toBe('string');
            expect(typeof updatedCase.sla_remaining_days).toBe('number');
            expect(typeof updatedCase.sla_remaining_hours).toBe('number');
            expect(typeof updatedCase.sla_remaining_minutes).toBe('number');

            expect(updatedCase.antiguedad).not.toBe(originalCase.antiguedad);
            expect(updatedCase.ans_posicion).toBeGreaterThanOrEqual(originalCase.ans_posicion);
        });

        it('should update SLA state fields when transition is changed', async () => {
            const transitionAns = await AnsMother.createAns(ansRepository, {
                intermedio: 1,
                vancido: 3,
                medicion_ans_id: Types.HOURS.value,
            });
            const initialTransition = await TransitionsMother.createRandomTransition(transitionRepository, {
                ans_id: transitionAns.id.value,
            });
            const newTransition = await TransitionsMother.createRandomTransition(transitionRepository, {
                ans_id: transitionAns.id.value,
            });

            const ans = await AnsMother.createAns(ansRepository, {
                intermedio: 2,
                vancido: 4,
                medicion_ans_id: Types.DAYS.value,
            });
            const classification = await ClassificationsMother.create(classificationRepository, {
                ans_id: ans.id.value,
            });

            const shifts = ShiftManagementMother.dto();
            const shiftManagement = await ShiftManagementMother.createShiftManagement(shiftManagementRepository, {
                holiday_dates: shifts.holiday_dates,
                work_days: shifts.work_days,
            });

            const group = await GroupsMother.createWithCustomShiftManagement(groupsRepository, shiftManagement);

            const kase = await CasesMother.createCase(repository, {
                transicion_id: initialTransition.id.value,
                clasificacion_id: classification.id.value,
                grupo_id: group.id.value,
            });

            await new Promise((resolve) => setTimeout(resolve, 100));

            const caseUpdater = new CaseUpdater(repository, actionExecutionServiceMock, currentUser);
            await caseUpdater.execute(kase.id.value, {
                transicion_id: newTransition.id.value,
                updated_at: new Date(),
                updated_by: currentUser.id.value,
            });

            const updatedCase = await repository.connection('cases').where({ id: kase.id.value }).first();

            expect(updatedCase.transicion_id).toBe(newTransition.id.value);
            expect(updatedCase.state_change_at).toBeDefined();

            expect(typeof updatedCase.state_elapsed_time).toBe('string');
            expect(typeof updatedCase.state_elapsed_days).toBe('number');
            expect(typeof updatedCase.state_elapsed_hours).toBe('number');
            expect(typeof updatedCase.state_elapsed_minutes).toBe('number');

            expect(typeof updatedCase.sla_state_position).toBe('number');
            expect(typeof updatedCase.sla_state_elapsed_time).toBe('string');
            expect(typeof updatedCase.sla_state_elapsed_days).toBe('number');
            expect(typeof updatedCase.sla_state_elapsed_hours).toBe('number');
            expect(typeof updatedCase.sla_state_elapsed_minutes).toBe('number');

            // `sla_state_due_date` es timestamp: pg lo devuelve como Date.
            expect(updatedCase.sla_state_due_date).toBeInstanceOf(Date);
            expect(typeof updatedCase.sla_state_remaining_time).toBe('string');
            expect(typeof updatedCase.sla_state_remaining_days).toBe('number');
            expect(typeof updatedCase.sla_state_remaining_hours).toBe('number');
            expect(typeof updatedCase.sla_state_remaining_minutes).toBe('number');

            expect(updatedCase.sla_state_elapsed_days).toBe(0);
            expect(updatedCase.sla_state_elapsed_hours).toBe(0);
        });

        it('should maintain SLA accuracy over multiple updates', async () => {
            const transitionAns = await AnsMother.createAns(ansRepository, {
                intermedio: 4,
                vancido: 8,
                medicion_ans_id: Types.HOURS.value,
            });
            const transitions = await TransitionsMother.createRandomTransition(transitionRepository, {
                ans_id: transitionAns.id.value,
            });

            const ans = await AnsMother.createAns(ansRepository, {
                intermedio: 1,
                vancido: 2,
                medicion_ans_id: Types.DAYS.value,
            });
            const classification = await ClassificationsMother.create(classificationRepository, {
                ans_id: ans.id.value,
            });

            const shifts = ShiftManagementMother.dto();
            const shiftManagement = await ShiftManagementMother.createShiftManagement(shiftManagementRepository, {
                holiday_dates: shifts.holiday_dates,
                work_days: shifts.work_days,
            });

            const group = await GroupsMother.createWithCustomShiftManagement(groupsRepository, shiftManagement);

            const kase = await CasesMother.createCase(repository, {
                transicion_id: transitions.id.value,
                clasificacion_id: classification.id.value,
                grupo_id: group.id.value,
            });

            const caseUpdater = new CaseUpdater(repository, actionExecutionServiceMock, currentUser);

            await new Promise((resolve) => setTimeout(resolve, 50));
            await caseUpdater.execute(kase.id.value, {
                antiguedad: 'first update',
                updated_at: new Date(),
            });

            const firstUpdate = await repository.connection('cases').where({ id: kase.id.value }).first();

            await new Promise((resolve) => setTimeout(resolve, 50));
            await caseUpdater.execute(kase.id.value, {
                antiguedad: 'second update',
                updated_at: new Date(),
            });

            const secondUpdate = await repository.connection('cases').where({ id: kase.id.value }).first();

            expect(secondUpdate.ans_posicion).toBeGreaterThanOrEqual(firstUpdate.ans_posicion);
            expect(secondUpdate.sla_position).toBeGreaterThanOrEqual(firstUpdate.sla_position);

            expect(secondUpdate.sla_remaining_days).toBeLessThanOrEqual(firstUpdate.sla_remaining_days);

            expect(secondUpdate.antiguedad).toBe(secondUpdate.sla_elapsed_time);
            expect(secondUpdate.ans_posicion).toBe(secondUpdate.sla_position);
            expect(secondUpdate.antiguedad_dias).toBe(secondUpdate.sla_elapsed_days);
            expect(secondUpdate.antiguedad_horas).toBe(secondUpdate.sla_elapsed_hours);
            expect(secondUpdate.antiguedad_minutos).toBe(secondUpdate.sla_elapsed_minutes);
        });
    });

    it('can fetch cases with search criteria avoid ambiguos fields', async () => {
        const client = await ClientMother.createClient(clientRepository);
        const transitions = await TransitionsMother.createTransition(transitionRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: transitions.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });

        const caseSearcher = new CaseSearcher(repository);

        const dtoCriteria = {
            filter: [
                {
                    field: 'parent_id',
                    operator: 'null',
                    value: 'null',
                    type: 'AND',
                },
                {
                    field: 'deleted_at',
                    operator: 'null',
                    value: 'null',
                    type: 'AND',
                },
            ],
            relationship: null,
            order: {
                field: 'created_at',
                direction: 'desc',
            },
            limit: 10,
            offset: 0,
        };

        const caseData = await caseSearcher.execute(dtoCriteria);

        const caseJson = caseData.toJson();

        expect(caseData).toBeInstanceOf(CaseDataGridResponse);
        expect(caseJson.data.items.length).toEqual(1);
        expect(caseJson.data.items[0].parent_id).toBeNull();
        expect(caseJson.data.items[0].deleted_at).toBeUndefined();
    });

    it('should NOT allow updating a case that is already resolved (has fecha_resolucion)', async () => {
        const closedAt = new Date().toISOString();
        const originalValue = 'valor-original';

        const kase = await CasesMother.createCase(repository, {
            fecha_resolucion: closedAt,
            motivo_baja: originalValue,
        });

        const caseUpdater = new CaseUpdater(repository, actionExecutionServiceMock, currentUser);

        const updatePromise = caseUpdater.execute(kase.id.value, {
            motivo_baja: 'nuevo-valor-no-deberia-guardarse',
            updated_at: new Date(),
        });

        await expect(updatePromise).rejects.toThrow(CustomError);
        await expect(updatePromise).rejects.toThrow('The case is already resolved; updates are not allowed.');

        const kaseReloaded = await repository.connection('cases').first('*').where({ id: kase.id.value });

        expect(kaseReloaded.fecha_resolucion).not.toBeNull();

        expect(kaseReloaded.motivo_baja).toBe(originalValue);
    });

    it('should update is_visible for all cases matching criteria', async () => {
        const client = await ClientMother.createClient(clientRepository);
        const transitions = await TransitionsMother.createTransition(transitionRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        const visibleCase = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: transitions.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
            motivo_baja: 'VISIBLE_TEST',
            is_visible: true,
        });

        const hiddenCase = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: transitions.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
            motivo_baja: 'OTHER_TEST',
            is_visible: true,
        });

        const dtoCriteria = {
            filter: [
                {
                    field: 'cases.motivo_baja',
                    operator: 'eq',
                    value: 'VISIBLE_TEST',
                    type: 'AND',
                },
            ],
            relationship: null,
            order: null,
            limit: 10,
            offset: 0,
        };

        const visibleSearcher = new VisibleCaseSearcher(repository);

        const response = await visibleSearcher.execute(dtoCriteria, false);
        const json = response.toJson();

        expect(json.data.items).toHaveLength(1);
        expect(json.data.items[0].id).toBe(visibleCase.id.value);
        expect(json.data.items[0].is_visible).toBe(false);

        const updated = await repository.connection('cases').where({ id: visibleCase.id.value }).first();

        const untouched = await repository.connection('cases').where({ id: hiddenCase.id.value }).first();

        expect(updated.is_visible).toBe(false);
        expect(untouched.is_visible).toBe(true);
    });

    describe('Folio Feature', () => {
        let validDtoTemplate = {};

        beforeEach(async () => {
            const kase = await CasesMother.createCaseWithRelations(repository);
            const rawCase = await repository.connection('cases').first('*').where({ id: kase.id.value });
            validDtoTemplate = {
                cliente_id: rawCase.cliente_id,
                transicion_id: rawCase.transicion_id,
                responsable_id: rawCase.responsable_id,
                clasificacion_id: rawCase.clasificacion_id,
                grupo_id: rawCase.grupo_id,
                descripcion_caso_id: rawCase.descripcion_caso_id,
                created_by: rawCase.created_by,
                sla_id: rawCase.sla_id,
                sla_state_id: rawCase.sla_state_id,
            };
        });

        it('should apply folio on create when enabled', async () => {
            const config = { add_folio_to_external_code: true };
            const prefix = 'M20260118';
            const dto = CasesMother.dto({
                ...validDtoTemplate,
                external_code: prefix,
                created_at: dayjs().toISOString(),
            });

            await new CaseCreator(repository, actionExecutionServiceMock).execute(dto, config);

            const createdCase = await repository.connection('cases').first('*').where({ id: dto.id });
            expect(createdCase.external_code).toBe(`${prefix}0001`);
        });

        it('should increment folio sequentially for the same prefix', async () => {
            const config = { add_folio_to_external_code: true };
            const prefix = 'M20260118';
            const today = dayjs().toISOString();

            const dto1 = CasesMother.dto({ ...validDtoTemplate, external_code: prefix, created_at: today });
            await new CaseCreator(repository, actionExecutionServiceMock).execute(dto1, config);

            const dto2 = CasesMother.dto({ ...validDtoTemplate, external_code: prefix, created_at: today });
            await new CaseCreator(repository, actionExecutionServiceMock).execute(dto2, config);

            const case1 = await repository.connection('cases').first('*').where({ id: dto1.id });
            const case2 = await repository.connection('cases').first('*').where({ id: dto2.id });

            expect(case1.external_code).toBe(`${prefix}0001`);
            expect(case2.external_code).toBe(`${prefix}0002`);
        });

        it('should have independent counters for different prefixes', async () => {
            const config = { add_folio_to_external_code: true };
            const today = dayjs().toISOString();

            const prefixA = 'A20260118';
            const prefixB = 'B20260118';

            await new CaseCreator(repository, actionExecutionServiceMock).execute(
                CasesMother.dto({ ...validDtoTemplate, external_code: prefixA, created_at: today }),
                config
            );
            await new CaseCreator(repository, actionExecutionServiceMock).execute(
                CasesMother.dto({ ...validDtoTemplate, external_code: prefixB, created_at: today }),
                config
            );
            await new CaseCreator(repository, actionExecutionServiceMock).execute(
                CasesMother.dto({ ...validDtoTemplate, external_code: prefixA, created_at: today }),
                config
            );

            const cases = await repository
                .connection('cases')
                .select('external_code')
                .whereIn('external_code', [`${prefixA}0001`, `${prefixB}0001`, `${prefixA}0002`]);

            const codes = cases.map((c) => c.external_code);
            expect(codes).toContain(`${prefixA}0001`);
            expect(codes).toContain(`${prefixB}0001`);
            expect(codes).toContain(`${prefixA}0002`);
        });

        it('should use configurable folio length', async () => {
            const config = {
                add_folio_to_external_code: true,
                folio_length: 5,
            };
            const prefix = 'SHORT';
            const today = dayjs().toISOString();

            const dto = CasesMother.dto({ ...validDtoTemplate, external_code: prefix, created_at: today });
            await new CaseCreator(repository, actionExecutionServiceMock).execute(dto, config);

            const createdCase = await repository.connection('cases').first('*').where({ id: dto.id });
            expect(createdCase.external_code).toBe('SHORT00001');
        });

        it('should not change external_code if folio is disabled', async () => {
            const config = { add_folio_to_external_code: false };
            const dto = CasesMother.dto({ ...validDtoTemplate, external_code: 'FIXED' });

            await new CaseCreator(repository, actionExecutionServiceMock).execute(dto, config);

            const createdCase = await repository.connection('cases').first('*').where({ id: dto.id });
            expect(createdCase.external_code).toBe('FIXED');
        });

        it('should not generate folio when external_code is not provided', async () => {
            const config = { add_folio_to_external_code: true };
            const dto = CasesMother.dto({ ...validDtoTemplate });
            delete dto.external_code;

            await new CaseCreator(repository, actionExecutionServiceMock).execute(dto, config);

            const createdCase = await repository.connection('cases').first('*').where({ id: dto.id });
            expect(createdCase.external_code).toBeNull();
        });

        it('should not generate folio when external_code is null', async () => {
            const config = { add_folio_to_external_code: true };
            const dto = CasesMother.dto({ ...validDtoTemplate, external_code: null });

            await new CaseCreator(repository, actionExecutionServiceMock).execute(dto, config);

            const createdCase = await repository.connection('cases').first('*').where({ id: dto.id });
            expect(createdCase.external_code).toBeNull();
        });

        it('should not generate folio when external_code is empty string', async () => {
            const config = { add_folio_to_external_code: true };
            const dto = CasesMother.dto({ ...validDtoTemplate, external_code: '' });

            await new CaseCreator(repository, actionExecutionServiceMock).execute(dto, config);

            const createdCase = await repository.connection('cases').first('*').where({ id: dto.id });
            expect(createdCase.external_code).toBe('');
        });
    });
});

describe('Cases Integration Tests - PostgreSQL (aux_cases JSON numeric ordering)', () => {
    const pgRepository = new KnexCaseRepository(knexConfig);
    const pgGroupsRepository = new KnexGroupsRepository(pgRepository.connection);
    const pgShiftManagementRepository = new KnexShiftManagementRepository(pgRepository.connection);
    const pgGlobalConfigurationRepository = new KnexGlobalConfigurationRepository(pgRepository.connection);

    let group;

    beforeEach(async () => {
        group = await GroupsMother.createGroup(pgGroupsRepository, pgShiftManagementRepository);
    });

    async function findByGroup(sortingRules) {
        return pgRepository.findAllMatchingCondition(
            { 'cases.fecha_resolucion': null, 'cases.grupo_id': group.id.value },
            { work_queue_sorting_rules: sortingRules }
        );
    }

    async function createPgCaseWithAuxNumericValue(groupId, vencimientoValue) {
        const estadoId = uuidv4();
        const transicionId = uuidv4();
        const clienteId = uuidv4();
        const clasificacionId = uuidv4();
        const descripcionCasoId = uuidv4();
        const responsableId = uuidv4();
        const creatorId = uuidv4();

        await pgRepository.connection('estados').insert({ id: estadoId, nombre: `estado_${estadoId.slice(0, 8)}` });
        await pgRepository.connection('transiciones').insert({ id: transicionId, siguiente_estado_id: estadoId });
        await pgRepository.connection('usuarios').insert({ id: responsableId, nombres: 'responsable_test' });
        await pgRepository.connection('usuarios').insert({ id: creatorId, nombres: 'creator_test' });
        await pgRepository
            .connection('clients')
            .insert({ id: clienteId, documento: '12345678', created_by: creatorId });
        await pgRepository.connection('clasificaciones').insert({ id: clasificacionId, created_by: creatorId });
        await pgRepository.connection('descripciones_casos').insert({ id: descripcionCasoId });

        const kase = await CasesMother.createCase(pgRepository, {
            cliente_id: clienteId,
            transicion_id: transicionId,
            responsable_id: responsableId,
            clasificacion_id: clasificacionId,
            descripcion_caso_id: descripcionCasoId,
            grupo_id: groupId,
            created_by: creatorId,
        });

        await pgRepository.connection('aux_cases').insert({
            id: uuidv4(),
            caso_id: kase.id.value,
            data: { form_vida_salud: { vencimiento: vencimientoValue } },
            created_by: creatorId,
        });

        return kase;
    }

    const INT_DESC = [
        { assign_strategy: 'aux_cases.form_vida_salud.vencimiento', order_type: 'DESC', cast_type: 'int' },
    ];
    const STRING_DESC = [{ assign_strategy: 'aux_cases.form_vida_salud.vencimiento', order_type: 'DESC' }];

    it('Must find and order cases with bigint numeric aux values when cast_type is int in PostgreSQL', async () => {
        // 3156954875 < 3215789659 — case with bigger value created second (newer)
        await createPgCaseWithAuxNumericValue(group.id.value, 3156954875);
        await createPgCaseWithAuxNumericValue(group.id.value, 3215789659);

        const find = await findByGroup(INT_DESC);

        expect(find.length).toBe(2);
        expect(new Date(find[0].created_at.value).getTime()).toBeGreaterThan(
            new Date(find[1].created_at.value).getTime()
        );
    });

    it('Must find and order cases with numeric aux values when cast_type is int in PostgreSQL', async () => {
        // 5 < 10 — case with vencimiento=10 created second (newer)
        await createPgCaseWithAuxNumericValue(group.id.value, 5);
        await createPgCaseWithAuxNumericValue(group.id.value, 10);

        const find = await findByGroup(INT_DESC);

        expect(find.length).toBe(2);
        expect(new Date(find[0].created_at.value).getTime()).toBeGreaterThan(
            new Date(find[1].created_at.value).getTime()
        );
    });

    it('Confirms bug: default cast_type uses string comparison causing wrong ordering for multi-digit numeric aux values in PostgreSQL', async () => {
        // vencimiento=9 (older), vencimiento=10 (newer)
        // Lexicographically '9' > '10', so the OLDER case comes first in DESC string order
        await createPgCaseWithAuxNumericValue(group.id.value, 9);
        await createPgCaseWithAuxNumericValue(group.id.value, 10);

        const find = await findByGroup(STRING_DESC);

        expect(find.length).toBe(2);
        expect(new Date(find[0].created_at.value).getTime()).toBeLessThan(new Date(find[1].created_at.value).getTime());
    });

    it('Must order 5 cases with small numeric aux values (1-10) DESC when cast_type is int', async () => {
        // Expected DESC result: 10, 8, 6, 4, 2 → find[0] is newest, find[4] is oldest
        for (const value of [2, 4, 6, 8, 10]) {
            await createPgCaseWithAuxNumericValue(group.id.value, value);
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const find = await findByGroup(INT_DESC);

        expect(find.length).toBe(5);
        for (let i = 0; i < find.length - 1; i++) {
            expect(new Date(find[i].created_at.value).getTime()).toBeGreaterThan(
                new Date(find[i + 1].created_at.value).getTime()
            );
        }
    });

    it('Must order 5 cases with large numeric aux values (100k-900k) DESC when cast_type is int', async () => {
        // Expected DESC result: 900000, 700000, 500000, 300000, 100000 → find[0] is newest, find[4] is oldest
        for (const value of [100000, 300000, 500000, 700000, 900000]) {
            await createPgCaseWithAuxNumericValue(group.id.value, value);
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const find = await findByGroup(INT_DESC);

        expect(find.length).toBe(5);
        for (let i = 0; i < find.length - 1; i++) {
            expect(new Date(find[i].created_at.value).getTime()).toBeGreaterThan(
                new Date(find[i + 1].created_at.value).getTime()
            );
        }
    });

    it('Must order 5 cases with mixed numeric aux values (1-10 and 100k-900k interleaved) DESC when cast_type is int', async () => {
        // Expected DESC result: 800000, 500000, 200000, 7, 3 → find[0] is newest, find[4] is oldest
        for (const value of [3, 7, 200000, 500000, 800000]) {
            await createPgCaseWithAuxNumericValue(group.id.value, value);
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const find = await findByGroup(INT_DESC);

        expect(find.length).toBe(5);
        for (let i = 0; i < find.length - 1; i++) {
            expect(new Date(find[i].created_at.value).getTime()).toBeGreaterThan(
                new Date(find[i + 1].created_at.value).getTime()
            );
        }
    });
});
