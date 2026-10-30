import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { KnexCaseRepository, KnexViewCaseRepository, ViewCasesGroupCounter } from '../../src/cases/index.js';
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
import { ensureParentRow } from '../support/ensureParentRow.js';
import { refreshMatview } from '../support/refreshMatview.js';

describe('ViewCases entity counters Integration Test', () => {
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

    // Las vistas no llevan ORDER BY, asi que postgres puede devolver los estados
    // de cada entidad en cualquier orden. Los indexamos por su nombre -que fija
    // el propio test- en vez de ordenarlos por `count`: asi la asercion no
    // depende de algo que la vista nunca garantizo, sigue siendo estable si dos
    // estados empatan en total, y el diff de jest senala el estado por su nombre
    // en lugar de un indice de array lleno de uuids.
    const byEstado = (entities) =>
        Object.fromEntries(
            Object.entries(entities).map(([key, entity]) => [
                key,
                { ...entity, estados: Object.fromEntries(entity.estados.map((row) => [row.estado, row])) },
            ])
        );

    it('reads group counts from the materialized view grouped by entity', async () => {
        const open = await StateMother.createState(stateRepository, { nombre: 'Abierto' });
        const closed = await StateMother.createState(stateRepository, { nombre: 'Cerrado' });
        const toOpen = await TransitionsMother.createTransition(transitionRepository, null, null, open);
        const toClosed = await TransitionsMother.createTransition(transitionRepository, null, null, closed);
        const support = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository, {
            nombre: 'Soporte',
        });

        await CasesMother.createCases(caseRepository, 4, {
            ...relations,
            grupo_id: support.id.value,
            transicion_id: toOpen.id.value,
        });
        await CasesMother.createCases(caseRepository, 2, {
            ...relations,
            grupo_id: support.id.value,
            transicion_id: toClosed.id.value,
        });
        await refreshMatview(connection, 'mv_dashboard_group_counts');

        const result = await repository.getGroupCountsFromView();

        expect(byEstado(result)).toEqual({
            [support.id.value]: {
                id: support.id.value,
                nombre: 'Soporte',
                estados: {
                    Abierto: { id: open.id.value, estado: 'Abierto', count: 4 },
                    Cerrado: { id: closed.id.value, estado: 'Cerrado', count: 2 },
                },
            },
        });
    });

    it('reads responsible counts from the materialized view grouped by entity', async () => {
        const open = await StateMother.createState(stateRepository, { nombre: 'Abierto' });
        const toOpen = await TransitionsMother.createTransition(transitionRepository, null, null, open);
        // La vista compone el nombre como concat(nombres, ' ', apellido1).
        const responsible = await UsersMother.createUser(usersRepository, { nombres: 'Juan', apellido1: 'Perez' });

        await CasesMother.createCases(caseRepository, 3, {
            ...relations,
            responsable_id: responsible.id.value,
            transicion_id: toOpen.id.value,
        });
        await refreshMatview(connection, 'mv_dashboard_responsible_counts');

        const result = await repository.getResponsibleCountsFromView();

        expect(byEstado(result)).toEqual({
            [responsible.id.value]: {
                id: responsible.id.value,
                nombre: 'Juan Perez',
                estados: { Abierto: { id: open.id.value, estado: 'Abierto', count: 3 } },
            },
        });
    });

    it('returns the expected shape for each estado entry', async () => {
        const open = await StateMother.createState(stateRepository, { nombre: 'Abierto' });
        const toOpen = await TransitionsMother.createTransition(transitionRepository, null, null, open);

        await CasesMother.createCases(caseRepository, 2, { ...relations, transicion_id: toOpen.id.value });
        await refreshMatview(connection, 'mv_dashboard_group_counts');

        const response = await new ViewCasesGroupCounter(repository).execute();
        const group = response.data.groups[relations.grupo_id];

        expect(group.estados.length).toBeGreaterThan(0);
        group.estados.forEach((state) => {
            expect(state).toHaveProperty('id');
            expect(state).toHaveProperty('estado');
            expect(state).toHaveProperty('count');
            expect(typeof state.count).toBe('number');
        });
    });

    it('uses Desconocido when estado_nombre is null', async () => {
        // `estados.nombre` es nullable y la vista propaga el null hasta el
        // repositorio. La fila se crea aqui a mano, y no con StateMother, porque
        // la entidad State normaliza `dto.nombre ?? 'default'` y nunca deja el
        // nombre en null. Antes el null llegaba de rebote -la transicion por
        // defecto de `relations` apuntaba a un estado que ensureParentRow habia
        // creado solo con su id-, asi que el dia que las factorias den un nombre
        // por defecto a `estados` este test fallaria sin ninguna pista aqui.
        const unnamedStateId = uuidv4();
        await ensureParentRow(connection, 'estados', unnamedStateId);
        const toUnnamed = await TransitionsMother.createRandomTransition(transitionRepository, {
            siguiente_estado_id: unnamedStateId,
        });

        await CasesMother.createCases(caseRepository, 1, { ...relations, transicion_id: toUnnamed.id.value });
        await refreshMatview(connection, 'mv_dashboard_group_counts');

        const result = await repository.getGroupCountsFromView();

        expect(result[relations.grupo_id].estados[0].estado).toBe('Desconocido');
    });

    it('returns empty object when matview has no rows', async () => {
        await refreshMatview(connection, 'mv_dashboard_group_counts');

        const result = await new ViewCasesGroupCounter(repository).execute();

        expect(result.data.groups).toEqual({});
    });
});

const getView = () => `
    CREATE VIEW view_case_details AS
    SELECT
        cases.id,
        cases.reference,
        cases.created_at,
        cases.grupo_id,
        cases.responsable_id,
        grupos.nombre as grupo_nombre,
        responsable.nombres || ' ' || responsable.apellido1 as responsable_nombre,
        estados.id as estado_id,
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
