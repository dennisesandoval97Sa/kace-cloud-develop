import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { KnexCaseRepository } from '../../src/cases';
import { KnexTransitionsCaseRepository } from '../../src/cases/infrastructure/persistence/KnexTransitionsCaseRepository.js';
import { KnexFlowRepository } from '../../src/flow';
import { KnexTransitionsRepository } from '../../src/transition';
import { KnexStateRepository } from '../../src/state';
import FlowsMother from '../flow/domain/FlowsMother';
import { TransitionsMother } from '../transition/domain/TransitionsMother';
import { StateMother } from '../state/domain/StateMother';

/**
 * `findStatesByFlowId` alimenta el desplegable de estados del flujo destino al reclasificar
 * (MSKT-1392 CORE-4). Lo que se ofrece aquí es lo que el asesor puede elegir y lo que el POST
 * va a aceptar, así que cada filtro de esta consulta es una regla de negocio, no una
 * optimización.
 */
describe('KnexTransitionsCaseRepository.findStatesByFlowId', () => {
    const caseRepository = new KnexCaseRepository(knexConfig);
    const repository = new KnexTransitionsCaseRepository(caseRepository.connection);
    const flowRepo = new KnexFlowRepository(caseRepository.connection);
    const stateRepo = new KnexStateRepository(caseRepository.connection);
    const transitionRepo = new KnexTransitionsRepository(caseRepository.connection);

    const softDelete = async (table, id) =>
        caseRepository.connection(table).where({ id }).update({ deleted_at: new Date() });

    const nextStateIds = (states) => states.map((available) => available.estado_siguiente.id.value);

    /**
     * `transition_rules` exige `nombre` y `conditions`; el DTO por defecto de `TransitionsMother`
     * no trae `rule_id`, así que la regla se siembra cuando el test la necesita.
     */
    async function seedRule() {
        const id = uuidv4();
        await caseRepository
            .connection('transition_rules')
            .insert({ id, nombre: `regla ${id}`, conditions: JSON.stringify({}) });

        return id;
    }

    async function seedFlowWithTransition(transitionOverrides = {}) {
        const origen = await StateMother.createState(stateRepo);
        const destino = await StateMother.createState(stateRepo);
        const flow = await FlowsMother.createFlow(flowRepo);
        const transition = await TransitionsMother.createRandomTransition(transitionRepo, {
            estado_actual_id: origen.id.value,
            siguiente_estado_id: destino.id.value,
            flujo_id: flow.id.value,
            ...transitionOverrides,
        });

        return { origen, destino, flow, transition };
    }

    it('devuelve los estados alcanzables del flujo, con su transición', async () => {
        const { destino, flow, transition } = await seedFlowWithTransition();

        const states = await repository.findStatesByFlowId(flow.id.value);

        expect(states).toHaveLength(1);
        expect(states[0].transition.id.value).toBe(transition.id.value);
        expect(states[0].estado_siguiente.id.value).toBe(destino.id.value);
    });

    it('omite una transición dada de baja', async () => {
        const { destino, flow, transition } = await seedFlowWithTransition();
        await softDelete('transiciones', transition.id.value);

        const states = await repository.findStatesByFlowId(flow.id.value);

        expect(nextStateIds(states)).not.toContain(destino.id.value);
    });

    it('omite una transición cuyo estado destino fue dado de baja', async () => {
        const { destino, flow } = await seedFlowWithTransition();
        await softDelete('estados', destino.id.value);

        const states = await repository.findStatesByFlowId(flow.id.value);

        expect(nextStateIds(states)).not.toContain(destino.id.value);
    });

    it('omite una transición oculta', async () => {
        const { destino, flow } = await seedFlowWithTransition({ is_visible: false });

        const states = await repository.findStatesByFlowId(flow.id.value);

        expect(nextStateIds(states)).not.toContain(destino.id.value);
    });

    it('devuelve vacío sin flujo', async () => {
        await expect(repository.findStatesByFlowId(null)).resolves.toEqual([]);
    });

    /**
     * Un estado con varias aristas entrantes en el mismo flujo llegaba repetido. Quien consume
     * esto lista un botón por `state_id` y resuelve la transición desde el estado elegido, así
     * que el duplicado se traduce en dos botones idénticos y en persistir una transición que el
     * asesor no escogió.
     */
    describe('un estado alcanzable por varias transiciones', () => {
        async function seedTwoEdgesToSameState(secondOverrides = {}) {
            const { destino, flow, transition } = await seedFlowWithTransition();
            const otroOrigen = await StateMother.createState(stateRepo);
            const segunda = await TransitionsMother.createRandomTransition(transitionRepo, {
                estado_actual_id: otroOrigen.id.value,
                siguiente_estado_id: destino.id.value,
                flujo_id: flow.id.value,
                ...secondOverrides,
            });

            return { destino, flow, primera: transition, segunda };
        }

        it('se ofrece una sola vez', async () => {
            const { destino, flow } = await seedTwoEdgesToSameState();

            const states = await repository.findStatesByFlowId(flow.id.value);

            expect(nextStateIds(states)).toEqual([destino.id.value]);
        });

        it('prefiere la transición sin regla, que es la que el asesor siempre puede recorrer', async () => {
            const { flow, primera, segunda } = await seedTwoEdgesToSameState();
            await caseRepository
                .connection('transiciones')
                .where({ id: primera.id.value })
                .update({ rule_id: await seedRule() });

            const states = await repository.findStatesByFlowId(flow.id.value);

            expect(states).toHaveLength(1);
            expect(states[0].transition.id.value).toBe(segunda.id.value);
        });

        it('desempata de forma estable cuando ninguna tiene regla', async () => {
            const { flow, primera, segunda } = await seedTwoEdgesToSameState();

            const esperada = [primera.id.value, segunda.id.value].sort()[0];
            const [first, second] = await Promise.all([
                repository.findStatesByFlowId(flow.id.value),
                repository.findStatesByFlowId(flow.id.value),
            ]);

            expect(first[0].transition.id.value).toBe(esperada);
            expect(second[0].transition.id.value).toBe(esperada);
        });
    });

    /**
     * `findTransitionRulesByFlowId` describe las transiciones que `findStatesByFlowId` ofrece: lo
     * que aquí se cuele es lo que el precheck publica en su payload.
     */
    describe('findTransitionRulesByFlowId', () => {
        const ruleIds = (rules) => rules.map((rule) => rule.transicion_id);

        it('devuelve la regla de una transición vigente', async () => {
            const { flow, transition } = await seedFlowWithTransition({ rule_id: await seedRule() });

            const rules = await repository.findTransitionRulesByFlowId(flow.id.value);

            expect(ruleIds(rules)).toContain(transition.id.value);
        });

        it('omite la regla de una transición dada de baja', async () => {
            const { flow, transition } = await seedFlowWithTransition({ rule_id: await seedRule() });
            await softDelete('transiciones', transition.id.value);

            const rules = await repository.findTransitionRulesByFlowId(flow.id.value);

            expect(ruleIds(rules)).not.toContain(transition.id.value);
        });

        it('devuelve vacío sin flujo', async () => {
            await expect(repository.findTransitionRulesByFlowId(null)).resolves.toEqual([]);
        });

        /**
         * El árbol de condiciones es configuración del tenant y este payload acaba en
         * localStorage del navegador del asesor. Se publica el nombre de la regla, nada más.
         */
        it('no publica el árbol de condiciones de la regla', async () => {
            const { flow } = await seedFlowWithTransition({ rule_id: await seedRule() });

            const [rule] = await repository.findTransitionRulesByFlowId(flow.id.value);

            expect(rule).toBeDefined();
            expect(Object.keys(rule).sort()).toEqual(['nombre', 'rule_id', 'transicion_id']);
        });
    });

    afterAll(async () => {
        await caseRepository.destroyConnection();
    });
});
