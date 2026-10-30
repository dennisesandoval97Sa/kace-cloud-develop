import { knexConfig } from '../knexfile.js';
import {
    KnexCaseRepository,
    KnexViewCaseRepository,
    ViewCaseSearcher,
    CaseViewCollectionResponse,
} from '../../src/cases/index.js';
import CasesMother from './domain/CasesMother.js';
import { KnexAuxCasesRepository } from '../../src/aux_casos/index.js';
import { AuxCasesMother } from '../aux_casos/domain/AuxCasesMother.js';
import { KnexClientRepository } from '../../src/clients/index.js';
import { KnexTransitionsRepository } from '../../src/transition/index.js';
import { KnexUsersRepository } from '../../src/users/index.js';
import { KnexClassificationRepository } from '../../src/classifications/index.js';
import { KnexShiftManagementRepository } from '../../src/shift-management/index.js';
import { KnexGroupsRepository } from '../../src/grupos/index.js';
import ClientMother from '../clients/domain/ClientMother.js';
import { TransitionsMother } from '../transition/domain/TransitionsMother.js';
import UsersMother from '../users/domain/UsersMother.js';
import { GroupsMother } from '../grupos/domain/GroupsMother.js';
import ClassificationsMother from '../classifications/domain/ClassificationsMother.js';
import FlowsMother from '../flow/domain/FlowsMother.js';
import { KnexFlowRepository } from '../../src/flow/index.js';
import AnsMother from '../ans/domain/AnsMother.js';
import { KnexAnsRepository, Types } from '../../src/ans/index.js';
import { StateMother } from '../state/domain/StateMother.js';
import { SHARED_VISUAL_COLOR_ALLOWLIST } from '../../src/shared/visual-options/sharedVisualOptions.js';
import { KnexStateRepository } from '../../src/state/index.js';

describe('ViewCaseSearcher Integration Test', () => {
    const caseRepository = new KnexCaseRepository(knexConfig);
    const auxCasesRepository = new KnexAuxCasesRepository(caseRepository.connection);
    const repository = new KnexViewCaseRepository(caseRepository.connection, 'view_case_details');

    const viewCaseSearcher = new ViewCaseSearcher(repository);

    const clientRepository = new KnexClientRepository(caseRepository.connection);
    const transitionRepository = new KnexTransitionsRepository(caseRepository.connection);
    const usersRepository = new KnexUsersRepository(caseRepository.connection);
    const classificationRepository = new KnexClassificationRepository(caseRepository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(caseRepository.connection);
    const groupsRepository = new KnexGroupsRepository(caseRepository.connection);
    const flowRepository = new KnexFlowRepository(caseRepository.connection);
    const ansRepository = new KnexAnsRepository(caseRepository.connection);
    const stateRepository = new KnexStateRepository(caseRepository.connection);

    let kase;

    beforeEach(async () => {
        await repository.connection.raw('DROP VIEW IF EXISTS view_case_details');
        await repository.connection.raw(getView());

        const client = await ClientMother.createClient(clientRepository);
        const transitions = await TransitionsMother.createTransition(transitionRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        kase = await CasesMother.createCase(caseRepository, {
            cliente_id: client.id.value,
            transicion_id: transitions.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });
    });

    afterEach(async () => {
        await repository.connection.raw('DROP VIEW IF EXISTS view_case_details');
    });

    it('should return cases matching the search criteria', async () => {
        const auxCase = await AuxCasesMother.createAuxCase(auxCasesRepository, { caso_id: kase.id.value });

        const dtoCriteria = {
            filter: [
                {
                    field: 'causal',
                    operator: 'eq',
                    value: auxCase.data.value.numero_pedido,
                    type: 'AND',
                },
            ],
            relationship: [],
            order: {
                field: 'id',
                direction: 'DESC',
            },
            limit: 10,
            offset: 0,
        };

        const response = await viewCaseSearcher.execute(dtoCriteria);
        expect(response).toBeInstanceOf(CaseViewCollectionResponse);

        const responseData = response.toJson();
        expect(responseData.data.items.length).toBe(1);
        expect(responseData.data.items[0].id).toBe(kase.id.value);
        expect(responseData.data.items[0].motivo_baja).toBe(kase.motivo_baja.value);
        expect(responseData.data.items[0].causal).toBe(auxCase.data.value.numero_pedido);
        expect(Number(responseData.metadata.count.count)).toBe(1);
    });

    it('should return empty array when no cases match criteria', async () => {
        const dtoCriteria = {
            filter: [
                {
                    field: 'motivo_baja',
                    operator: 'eq',
                    value: 'non-existent-reason',
                    type: 'AND',
                },
            ],
            relationship: [],
            order: {
                field: 'id',
                direction: 'DESC',
            },
            limit: 10,
            offset: 0,
        };

        const response = await viewCaseSearcher.execute(dtoCriteria);
        const responseData = response.toJson();

        expect(responseData.data.items.length).toBe(0);
        expect(Number(responseData.metadata.count.count)).toBe(0);
    });

    it('should return countByStatus in metadata when searching cases', async () => {
        await AuxCasesMother.createAuxCase(auxCasesRepository, { caso_id: kase.id.value });

        const dtoCriteria = {
            filter: [],
            relationship: [],
            order: {
                field: 'id',
                direction: 'DESC',
            },
            limit: 10,
            offset: 0,
        };

        const response = await viewCaseSearcher.execute(dtoCriteria);
        const responseData = response.toJson();

        expect(response).toBeInstanceOf(CaseViewCollectionResponse);
        expect(responseData.metadata).toHaveProperty('countByStatus');
        expect(Array.isArray(responseData.metadata.countByStatus)).toBe(true);
        expect(responseData.metadata.countByStatus.length).toBeGreaterThan(0);

        // Verify total count matches sum of per-status counts
        const totalFromStatus = responseData.metadata.countByStatus.reduce((sum, s) => sum + s.count, 0);
        expect(totalFromStatus).toBe(responseData.data.items.length);
    });

    it('should return countByStatus with color from estados when searching cases', async () => {
        const client = await ClientMother.createClient(clientRepository);
        const responsible = await UsersMother.createUser(usersRepository);
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

        const stateA = await StateMother.createState(stateRepository, {
            nombre: 'Estado Vista A',
            color: SHARED_VISUAL_COLOR_ALLOWLIST[0],
        });
        const stateB = await StateMother.createState(stateRepository, {
            nombre: 'Estado Vista B',
            color: SHARED_VISUAL_COLOR_ALLOWLIST[8],
        });

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

        await CasesMother.createCase(caseRepository, {
            cliente_id: client.id.value,
            transicion_id: transitionA.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });
        await CasesMother.createCase(caseRepository, {
            cliente_id: client.id.value,
            transicion_id: transitionB.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });

        const dtoCriteria = {
            filter: [],
            relationship: [],
            order: {
                field: 'id',
                direction: 'DESC',
            },
            limit: 10,
            offset: 0,
        };

        const response = await viewCaseSearcher.execute(dtoCriteria);
        const responseData = response.toJson();

        const countByStatus = responseData.metadata.countByStatus;
        const rowA = countByStatus.find((s) => s.status === 'Estado Vista A');
        const rowB = countByStatus.find((s) => s.status === 'Estado Vista B');

        expect(rowA).toBeDefined();
        expect(rowA).toHaveProperty('color');
        expect(rowA.color).toBe(SHARED_VISUAL_COLOR_ALLOWLIST[0]);
        expect(rowB).toBeDefined();
        expect(rowB).toHaveProperty('color');
        expect(rowB.color).toBe(SHARED_VISUAL_COLOR_ALLOWLIST[8]);
    });

    it('should return all expected columns from the view', async () => {
        const auxCase = await AuxCasesMother.createAuxCase(auxCasesRepository, {
            caso_id: kase.id.value,
        });

        const dtoCriteria = {
            filter: [
                {
                    field: 'id',
                    operator: 'eq',
                    value: kase.id.value,
                    type: 'AND',
                },
            ],
            relationship: [],
            order: {
                field: 'id',
                direction: 'DESC',
            },
            limit: 1,
            offset: 0,
        };
        const response = await viewCaseSearcher.execute(dtoCriteria);
        const responseData = response.toJson();

        expect(responseData.data.items.length).toBeGreaterThan(0);

        const item = responseData.data.items[0];

        const expectedColumns = [
            'id',
            'reference',
            'created_at',
            'updated_at',
            'nombreCliente',
            'primerApellido',
            'segundoApellido',
            'documento',
            'tipo_cliente',
            'nombres',
            'apellido1',
            'apellido2',
            'login',
            'usuario_inactivo',
            'nivel1',
            'nivel2',
            'nivel3',
            'nivel4',
            'nivel5',
            'nivel6',
            'nivel7',
            'nivel8',
            'nivel9',
            'nivel10',
            'causal',
            'respuesta',
            'estado_actual',
            'color_ans_inicial',
            'color_ans_intermedio',
            'color_ans_final',
            'motivo_baja',
            'fecha_resolucion',
            'antiguedad_dias',
            'antiguedad_horas',
            'antiguedad_minutos',
        ];

        expectedColumns.forEach((col) => {
            expect(item).toHaveProperty(col);
        });

        expect(item.id).toBe(kase.id.value);
        expect(item.causal).toBe(auxCase.data.value.numero_pedido);
    });
});

const getView = () => `
    CREATE VIEW view_case_details AS
    SELECT 
        -- Equivalente en postgres del \`json_extract(campo, '$.clave')\` de sqlite.
        -- Se usa \`->>\` y no \`->\` porque la vista tiene que entregar el valor como
        -- texto: \`->\` devolveria jsonb, o sea la cadena entrecomillada ("123456"),
        -- y ni el filtro por \`causal\` ni la asercion contra \`auxCase.data.value\`
        -- casarian con eso.
        aux_cases.data ->> 'tipo_usuario' AS respuesta,
        aux_cases.data ->> 'numero_pedido' AS causal,
        cases.id,
        cases.reference,
        cases.created_at,
        cases.created_by,
        clasificaciones.nivel1,
        clasificaciones.nivel2,
        clasificaciones.nivel3,
        clasificaciones.nivel4,
        clasificaciones.nivel5,
        clasificaciones.nivel6,
        clasificaciones.nivel7,
        clasificaciones.nivel8,
        clasificaciones.nivel9,
        clasificaciones.nivel10,
        ans.color_ans_inicial,
        ans.color_ans_intermedio,
        ans.color_ans_final,
        estados.nombre as estado_actual,
        cases.antiguedad,
        cases.updated_at,
        cases.ans_posicion,
        responsable.nombres,
        responsable.apellido1,
        responsable.apellido2,
        responsable.login,
        responsable.is_active as usuario_inactivo,
        creador.external_id as creator_external_id,
        clients.nombres as nombreCliente,
        clients.apellido1 as primerApellido,
        clients.apellido2 as segundoApellido,
        clients.documento,
        clients.tipo_cliente,
        clients.nombre_empresa,
        cases.cambio_estado_comentario_id,
        cases.caso_clonado_id,
        cases.fecha_resolucion,
        cases.antiguedad_dias,
        cases.antiguedad_horas,
        cases.antiguedad_minutos,
        cases.motivo_baja
    FROM cases
    JOIN clients ON clients.id = cases.cliente_id
    JOIN grupos ON grupos.id = cases.grupo_id
    JOIN usuarios AS responsable ON responsable.id = cases.responsable_id
    JOIN transiciones ON transiciones.id = cases.transicion_id
    JOIN clasificaciones ON clasificaciones.id = cases.clasificacion_id
    LEFT JOIN ans ON ans.id = clasificaciones.ans_id
    LEFT JOIN descripciones_casos AS descripcion ON descripcion.id = cases.descripcion_caso_id
    LEFT JOIN estados ON estados.id = transiciones.siguiente_estado_id
    LEFT JOIN usuarios AS creador ON creador.id = cases.created_by
    LEFT JOIN aux_cases ON aux_cases.caso_id = cases.id;
`;
