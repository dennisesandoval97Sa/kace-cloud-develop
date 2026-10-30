import { Helper, KnexRepository, QueryDBError, StatusEnum } from '../../../shared/index.js';
import { CaseAvailableStates } from '../../index.js';

export class KnexTransitionsCaseRepository extends KnexRepository {
    /**
     * @param {object} config - Configuración del pool de escritura.
     * @param {object|null} [readerConfig] - Configuración del pool de réplica. Se acepta para que
     *   el servicio de precheck (API-3) pueda leer los estados del flujo destino desde la
     *   réplica sin abrir su propio repositorio.
     */
    constructor(config, readerConfig = null) {
        super(config, 'cases', readerConfig);
    }

    async findById(transitionId, { trx } = {}) {
        try {
            if (!transitionId) return null;

            const row = await (trx ? this.trxTable(trx, 'transiciones') : this.table('transiciones'))
                .select('id', 'rule_id', 'estado_actual_id', 'siguiente_estado_id', 'flujo_id')
                .where({ id: transitionId })
                .first();

            if (!row) return null;

            return {
                id: row.id,
                rule_id: row.rule_id ?? null,
                estado_actual_id: row.estado_actual_id ?? null,
                siguiente_estado_id: row.siguiente_estado_id,
                flujo_id: row.flujo_id ?? null,
            };
        } catch (error) {
            Helper.logError('Error finding transition by id:', error);
            throw new QueryDBError('find', 'Failed to find transition by id.');
        }
    }

    async findAvailableTransitions(transitionId, { trx } = {}) {
        try {
            if (!transitionId) {
                return { currentStateId: null, transitions: [] };
            }

            const tr = await (trx ? this.trxTable(trx, 'transiciones') : this.table('transiciones'))
                .select('flujo_id', 'siguiente_estado_id')
                .where({ id: transitionId })
                .first();

            if (!tr) return { currentStateId: null, transitions: [] };

            const flowId = tr.flujo_id;
            const currentStateId = tr.siguiente_estado_id;

            const rows = await (trx ? this.trxTable(trx, 'transiciones as t') : this.table('transiciones as t'))
                .leftJoin(`${this.qualifiedName('estados')} as e1`, 't.estado_actual_id', 'e1.id')
                .leftJoin(`${this.qualifiedName('estados')} as e2`, 't.siguiente_estado_id', 'e2.id')
                .select(
                    't.id as transicion_id',
                    't.estado_actual_id',
                    'e1.nombre as estado_actual_nombre',
                    'e1.status as estado_actual_status',
                    't.siguiente_estado_id',
                    'e2.nombre as estado_siguiente_nombre',
                    'e2.status as estado_siguiente_status',
                    't.rule_id'
                )
                .where({ 't.flujo_id': flowId, 't.estado_actual_id': currentStateId })
                .andWhere({ 't.status': 1 })
                .orderBy('estado_siguiente_nombre', 'asc');

            const transitions = rows.map((r) => ({
                transicion_id: r.transicion_id,
                siguiente_estado_id: r.siguiente_estado_id,
                estado_nombre: r.estado_siguiente_nombre,
                rule_id: r.rule_id ?? null,
            }));

            return { currentStateId, transitions };
        } catch (error) {
            Helper.logError('Error searching available transitions:', error);
            throw new QueryDBError('create', 'Failed to search available transitions.');
        }
    }

    /**
     * Es deliberadamente lo contrario de `findAvailableTransitions`: aquella parte del estado
     * actual del caso, y tras reclasificar el caso todavía está en un estado del flujo ANTERIOR,
     * así que filtrar por él devolvería la lista vacía. Aquí el flujo es el único criterio.
     *
     * `estados` no tiene `flujo_id` —la única relación estado↔flujo son las transiciones—, así
     * que los estados se resuelven recorriéndolas, igual que en
     * `KnexCaseRepository.findByIdForAvailableStates`. Se conservan sus mismos filtros
     * (`status` activo e `is_visible`) para que un estado oculto siga oculto también aquí, y
     * se añade `deleted_at IS NULL`: una transición dada de baja no es un destino ofrecible.
     *
     * Las dos consultas piden la fila completa a propósito: `Transitions` y `State` se hidratan
     * con casi todas sus columnas —auditoría y borrado lógico incluidos—, así que enumerarlas
     * aquí crearía un espejo del esquema que se desincroniza en silencio al añadir una columna.
     *
     * Devuelve UN elemento por estado alcanzable, no por transición: un estado con varias aristas
     * entrantes en el mismo flujo llegaría repetido, y quien lo consume lo lista por estado
     * (botón por `state_id`) y resuelve la transición a partir del estado elegido. Ver
     * `#pickTransitionPerState` para el criterio de desempate.
     *
     * @param {string} flowId
     * @returns {Promise<import('../../domain/AvailableStates.js').CaseAvailableStates[]>}
     */
    async findStatesByFlowId(flowId) {
        try {
            if (!flowId) return [];

            const transitions = await this.read
                .table('transiciones')
                .select('*')
                .where({ flujo_id: flowId, is_visible: true, status: StatusEnum.ACTIVE.value })
                .whereNull('deleted_at');

            if (transitions.length === 0) return [];

            const estadoIds = new Set();
            for (const transition of transitions) {
                if (transition.estado_actual_id) estadoIds.add(transition.estado_actual_id);
                if (transition.siguiente_estado_id) estadoIds.add(transition.siguiente_estado_id);
            }

            const estados = await this.read
                .table('estados')
                .select('*')
                .whereIn('id', [...estadoIds])
                .whereNull('deleted_at');
            const estadosMap = new Map(estados.map((estado) => [estado.id, estado]));

            // Una transición cuyo siguiente estado no existe no representa un estado
            // alcanzable, y `CaseAvailableStates` no admite construir `State` desde undefined.
            const reachable = transitions.filter((transition) => estadosMap.has(transition.siguiente_estado_id));

            return KnexTransitionsCaseRepository.#pickTransitionPerState(reachable).map(
                (transition) =>
                    new CaseAvailableStates(
                        transition,
                        estadosMap.get(transition.estado_actual_id),
                        estadosMap.get(transition.siguiente_estado_id)
                    )
            );
        } catch (error) {
            Helper.logError('Error searching states by flow id:', error);
            throw new QueryDBError('find', 'Failed to search states by flow id.');
        }
    }

    /**
     * Una transición por estado destino.
     *
     * Entre varias aristas al mismo estado se prefiere la que NO tiene regla: es la única que el
     * asesor puede recorrer siempre, mientras que una condicionada puede rechazarse al guardar.
     * A igualdad de condición gana el `id` menor, para que dos llamadas seguidas ofrezcan la
     * misma transición y el reintento de un guardado no cambie lo que se persiste.
     *
     * @param {Array<Object>} transitions - Transiciones con estado destino existente.
     * @returns {Array<Object>}
     */
    static #pickTransitionPerState(transitions) {
        const byState = new Map();

        for (const transition of transitions) {
            const current = byState.get(transition.siguiente_estado_id);
            if (!current || KnexTransitionsCaseRepository.#isPreferredTransition(transition, current)) {
                byState.set(transition.siguiente_estado_id, transition);
            }
        }

        return [...byState.values()];
    }

    static #isPreferredTransition(candidate, current) {
        const candidateHasRule = Boolean(candidate.rule_id);
        const currentHasRule = Boolean(current.rule_id);

        if (candidateHasRule !== currentHasRule) return currentHasRule;

        return String(candidate.id) < String(current.id);
    }

    /**
     * API-RULES (MSKT-1392) — las reglas que condicionan las transiciones de un flujo, indexables
     * por transición.
     *
     * Se devuelve por `transicion_id` y no por `rule_id` porque quien las consume ya tiene la
     * transición en la mano —la respuesta de estados publica el par estado↔transición— y así no
     * hace falta exponer `rule_id` en `TransitionsResponse`, que comparten otros endpoints.
     *
     * Aplica los mismos filtros que `findStatesByFlowId` para no describir transiciones que esa
     * lista no ofrece.
     *
     * Solo el NOMBRE de la regla, nunca su `conditions`: el árbol de condiciones es configuración
     * del administrador del tenant —rutas de campos y valores de comparación— y esta respuesta
     * viaja al plugin, al evento `kaceCaseReclassified` y de ahí a localStorage. El consumidor
     * únicamente necesita saber que la transición está condicionada y cómo se llama la regla.
     *
     * @param {string} flowId
     * @returns {Promise<Array<{ transicion_id: string, rule_id: string, nombre: string }>>}
     */
    async findTransitionRulesByFlowId(flowId) {
        try {
            if (!flowId) return [];

            const rows = await this.read
                .table('transiciones as t')
                .innerJoin(`${this.qualifiedName('transition_rules')} as r`, 't.rule_id', 'r.id')
                .select('t.id as transicion_id', 'r.id as rule_id', 'r.nombre')
                .where({
                    't.flujo_id': flowId,
                    't.is_visible': true,
                    't.status': StatusEnum.ACTIVE.value,
                })
                // `t.deleted_at` además de `r.deleted_at`: `findStatesByFlowId` no ofrece las
                // transiciones dadas de baja, y describirlas aquí filtraría al payload reglas de
                // transiciones que el asesor no puede elegir.
                .whereNull('t.deleted_at')
                .whereNull('r.deleted_at');

            return rows.map((row) => ({
                transicion_id: row.transicion_id,
                rule_id: row.rule_id,
                nombre: row.nombre,
            }));
        } catch (error) {
            Helper.logError('Error searching transition rules by flow id:', error);
            throw new QueryDBError('find', 'Failed to search transition rules by flow id.');
        }
    }
}
