import { knexConfig } from '../knexfile.js';
import { KnexCaseRepository, KnexViewCaseRepository, ViewCasesCounter } from '../../src/cases/index.js';
import CasesMother from './domain/CasesMother.js';
import { KnexClientRepository } from '../../src/clients/index.js';
import { KnexTransitionsRepository } from '../../src/transition/index.js';
import { KnexUsersRepository } from '../../src/users/index.js';
import { KnexClassificationRepository } from '../../src/classifications/index.js';
import { KnexShiftManagementRepository } from '../../src/shift-management/index.js';
import { KnexGroupsRepository } from '../../src/grupos/index.js';
import { KnexStateRepository } from '../../src/state/index.js';
import ClientMother from '../clients/domain/ClientMother.js';
import { TransitionsMother } from '../transition/domain/TransitionsMother.js';
import UsersMother from '../users/domain/UsersMother.js';
import { GroupsMother } from '../grupos/domain/GroupsMother.js';
import ClassificationsMother from '../classifications/domain/ClassificationsMother.js';
import { StateMother } from '../state/domain/StateMother.js';
import { refreshMatview } from '../support/refreshMatview.js';

describe('ViewCasesCounter Integration Test', () => {
    const caseRepository = new KnexCaseRepository(knexConfig);
    const connection = caseRepository.connection;
    const repository = new KnexViewCaseRepository(connection, 'view_case_details');

    const clientRepository = new KnexClientRepository(connection);
    const transitionRepository = new KnexTransitionsRepository(connection);
    const usersRepository = new KnexUsersRepository(connection);
    const classificationRepository = new KnexClassificationRepository(connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(connection);
    const groupsRepository = new KnexGroupsRepository(connection);
    const stateRepository = new KnexStateRepository(connection);

    let relations;

    beforeEach(async () => {
        await connection.raw('DROP VIEW IF EXISTS view_case_details');
        await connection.raw(getView());

        const client = await ClientMother.createClient(clientRepository);
        const transitions = await TransitionsMother.createTransition(transitionRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        relations = {
            cliente_id: client.id.value,
            transicion_id: transitions.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        };
    });

    // La vista no lleva ORDER BY, asi que postgres puede devolver las filas en
    // cualquier orden. Indexamos por el nombre -que fija el propio test- en vez
    // de ordenar por `count`: asi la asercion no depende de un detalle que la
    // vista nunca garantizo, sigue siendo estable si dos estados empatan en
    // total, y el diff de jest senala el estado por su nombre en lugar de un
    // indice de array lleno de uuids.
    const byName = (rows) => Object.fromEntries(rows.map((row) => [row.nombre, row]));

    it('reads ans counts from the materialized view', async () => {
        // `mv_dashboard_ans_counts` mapea `ans_posicion` 1/2/3 sobre
        // pending/to_overcome/defeated (solo casos sin resolver) y cuenta como
        // `managed` todo caso con `fecha_resolucion IS NOT NULL`, sea cual sea
        // su posicion. Los cuatro totales son distintos entre si a proposito:
        // eso es lo unico que hace falta para detectar cualquier permutacion de
        // columnas, en la vista o en el mapeo del repositorio, y evita sembrar
        // decenas de casos reales para asertar cuatro enteros.
        await CasesMother.createCases(caseRepository, 1, { ...relations, ans_posicion: 1 });
        await CasesMother.createCases(caseRepository, 2, { ...relations, ans_posicion: 2 });
        await CasesMother.createCases(caseRepository, 3, { ...relations, ans_posicion: 3 });
        await CasesMother.createCases(caseRepository, 4, {
            ...relations,
            fecha_resolucion: new Date().toISOString(),
        });
        await refreshMatview(connection, 'mv_dashboard_ans_counts');

        const result = await repository.getAnsCountsFromView();

        expect(result).toEqual({ pending: 1, toOvercome: 2, defeated: 3, managed: 4 });
    });

    it('returns zeros when the ans matview row is all zeros', async () => {
        await refreshMatview(connection, 'mv_dashboard_ans_counts');

        const result = await repository.getAnsCountsFromView();

        expect(result).toEqual({ pending: 0, toOvercome: 0, defeated: 0, managed: 0 });
    });

    // mv_dashboard_ans_counts es un agregado sin GROUP BY: siempre devuelve
    // exactamente una fila, tambien con la tabla `cases` vacia. El escenario
    // "sin fila" solo existia con la tabla de juguete de sqlite, de modo que
    // contra la vista real este caso degenera en "sin casos". La rama defensiva
    // `row?.pending ?? 0` del repositorio deja de estar cubierta por aqui.
    it('returns zeros when the ans matview has no row', async () => {
        await refreshMatview(connection, 'mv_dashboard_ans_counts');

        const result = await repository.getAnsCountsFromView();

        expect(result).toEqual({ pending: 0, toOvercome: 0, defeated: 0, managed: 0 });
    });

    it('reads state counts from the materialized view', async () => {
        const open = await StateMother.createState(stateRepository, {
            nombre: 'Abierto',
            icon_class: 'ArrowRight',
        });
        const inProgress = await StateMother.createState(stateRepository, {
            nombre: 'En proceso',
            icon_class: 'Clock',
        });
        const toOpen = await TransitionsMother.createTransition(transitionRepository, null, null, open);
        const toInProgress = await TransitionsMother.createTransition(transitionRepository, null, null, inProgress);

        await CasesMother.createCases(caseRepository, 7, { ...relations, transicion_id: toOpen.id.value });
        await CasesMother.createCases(caseRepository, 3, { ...relations, transicion_id: toInProgress.id.value });
        await refreshMatview(connection, 'mv_dashboard_state_counts');

        const result = await repository.getStateCountsFromView();

        expect(byName(result)).toEqual({
            Abierto: { id: open.id.value, nombre: 'Abierto', icon_class: 'ArrowRight', count: '7' },
            'En proceso': { id: inProgress.id.value, nombre: 'En proceso', icon_class: 'Clock', count: '3' },
        });
    });

    it('returns an empty array when the state matview has no rows', async () => {
        await refreshMatview(connection, 'mv_dashboard_state_counts');

        const result = await repository.getStateCountsFromView();

        expect(result).toEqual([]);
    });

    it('returns the expected shape for each state entry from the matview', async () => {
        const open = await StateMother.createState(stateRepository, {
            nombre: 'Abierto',
            icon_class: 'ArrowRight',
        });
        const toOpen = await TransitionsMother.createTransition(transitionRepository, null, null, open);

        await CasesMother.createCases(caseRepository, 5, { ...relations, transicion_id: toOpen.id.value });
        await refreshMatview(connection, 'mv_dashboard_state_counts');

        const response = await new ViewCasesCounter(repository).execute();

        expect(response.data.states.length).toBeGreaterThan(0);
        response.data.states.forEach((state) => {
            expect(state).toHaveProperty('nombre');
            expect(state).toHaveProperty('count');
            expect(typeof state.count).toBe('string');
        });
    });
});

const getView = () => `
    CREATE VIEW view_case_details AS
    SELECT
        cases.id,
        cases.reference,
        cases.created_at,
        estados.nombre as estado_actual,
        cases.ans_posicion,
        cases.fecha_resolucion
    FROM cases
    JOIN clients ON clients.id = cases.cliente_id
    JOIN grupos ON grupos.id = cases.grupo_id
    JOIN usuarios AS responsable ON responsable.id = cases.responsable_id
    JOIN transiciones ON transiciones.id = cases.transicion_id
    JOIN clasificaciones ON clasificaciones.id = cases.clasificacion_id
    LEFT JOIN estados ON estados.id = transiciones.siguiente_estado_id;
`;
