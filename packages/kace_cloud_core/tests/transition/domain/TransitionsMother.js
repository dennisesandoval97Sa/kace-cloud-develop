import { v4 as uuidv4 } from 'uuid';
import { StatusEnum } from '../../../src/shared';
import { Transitions } from '../../../src/transition';
import { ensureParentRows } from '../../support/ensureParentRow.js';

export class TransitionsMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `Transitions` entity.
     *
     * @returns {Object} The DTO containing the properties for an `Transitions` entity.
     */
    static dto(override = {}) {
        return {
            id: uuidv4(),
            estado_actual_id: uuidv4(),
            siguiente_estado_id: uuidv4(),
            flujo_id: uuidv4(),
            status: StatusEnum.ACTIVE.value,
            created_by: uuidv4(),
            created_at: new Date().toISOString(),
            ans_id: uuidv4(),
            is_visible: true,
            ...override,
        };
    }

    /**
     *
     * @param {States[]} states
     * @param {string} idFlow
     * @returns {object}
     */
    static createPayloadForNewTransition(states, idFlow) {
        return {
            states: [
                {
                    id: uuidv4(),
                    estado_actual_id: states[0].id.value,
                    siguiente_estado_id: states[0].id.value,
                },
                {
                    id: uuidv4(),
                    estado_actual_id: states[1].id.value,
                    siguiente_estado_id: states[1].id.value,
                },
            ],
            flujo_id: idFlow,
            status: StatusEnum.ACTIVE.value,
        };
    }

    /**
     * Garantiza que las filas padre referenciadas por las claves foraneas de
     * `transiciones` (estado_actual_id, siguiente_estado_id, flujo_id) existan
     * antes de guardar, porque postgres las exige.
     * Se garantiza SIEMPRE, tambien cuando el llamador fijo el id o paso un
     * `State`/`Flow` real: `ensureParentRow` es idempotente
     * (`onConflict('id').ignore()`), asi que respaldar una fila que ya existe no
     * cuesta nada, mientras que saltarsela deja el insert al borde de una
     * violacion de clave foranea. Una version anterior filtraba por `overrides`
     * asumiendo que quien fija el id ya creo la fila; esa asuncion es justo la
     * que fallaba, porque casi siempre es un uuid inventado.
     *
     * @param {import('knex').Knex} connection - `repository.connection`.
     * @param {Object} dto - DTO ya resuelto.
     * @param {Object} overrides - Overrides tal cual los paso el llamador. Ya no
     *   se usan para filtrar; se conservan por compatibilidad con los llamadores.
     * @returns {Promise<void>}
     */
    static async ensureRelations(connection, dto, overrides = {}) {
        const rows = [
            ['estado_actual_id', 'estados'],
            ['siguiente_estado_id', 'estados'],
            ['flujo_id', 'flujos'],
        ].map(([field, table]) => ({ table, id: dto[field] }));

        // Cuarta FK de `transiciones` segun pg_constraint
        // (`transiciones_rule_id_foreign`). `transition_rules` no admite una fila
        // con solo el id: `nombre` y `conditions` son NOT NULL sin default.
        rows.push({
            table: 'transition_rules',
            id: dto.rule_id,
            extra: { nombre: `regla de prueba ${dto.rule_id}`, conditions: JSON.stringify({}) },
        });

        await ensureParentRows(connection, rows);
    }

    /**
     * Creates an `Transitions` instance with the provided `state` and `flow` and saves it to the repository.
     *
     * @param {KnexTransitionsRepository} repository - The repository to save the `Transitions` instance.
     * @param {State} state relation state
     * @param {Flow} flow relation flow
     * @returns {Promise<Transitions>} The created `Transitions` instance.
     */
    static async createTransition(repository, state = null, flow = null, nextState = null, id = null, ans_id = null) {
        if (!repository) throw new Error('Invalid repository');

        const dto = {
            id: id ?? uuidv4(),
            estado_actual_id: state?.id?.value ?? uuidv4(),
            siguiente_estado_id: nextState?.id?.value ?? uuidv4(),
            flujo_id: flow?.id?.value ?? uuidv4(),
            status: StatusEnum.ACTIVE.value,
            created_by: uuidv4(),
            created_at: new Date().toISOString(),
            ans_id: ans_id ?? uuidv4(),
        };

        // Se garantizan SIEMPRE, tambien cuando el llamador paso un `State`/`Flow` real:
        // en ese caso el id sale de la entidad, que ya esta persistida, y respaldarla de
        // nuevo es un no-op por `onConflict('id').ignore()`. Filtrar por la truthiness de
        // la entidad no protegia de nada y dejaba fuera a quien pasaba una entidad sin
        // guardar.
        await ensureParentRows(repository.connection, [
            { table: 'estados', id: dto.estado_actual_id },
            { table: 'estados', id: dto.siguiente_estado_id },
            { table: 'flujos', id: dto.flujo_id },
        ]);

        const transitions = Transitions.create(dto);
        await repository.save(transitions);
        return transitions;
    }

    /**
     * Creates an `Transitions` instance and saves it to the repository.
     *
     * @param {KnexTransitionsRepository} repository - The repository to save the `Transitions` instance.
     * @returns {Promise<Transitions>} The created `Transitions` instance.
     */
    static async createTransitionWithRelations(repository) {
        const dto = TransitionsMother.dto();
        await TransitionsMother.ensureRelations(repository.connection, dto, {});
        const transitions = Transitions.create(dto);
        await repository.save(transitions);
        return transitions;
    }

    /**
     * Creates a `Transitions` instance with random properties and saves it to the repository.
     *
     * @param {KnexTransitionsRepository} repository - The repository to save the `Transitions` instance.
     * @returns {Promise<Transitions>} The created `Transitions` instance.
     */
    static async createRandomTransition(repository, overrides = {}) {
        const dto = TransitionsMother.dto(overrides);
        await TransitionsMother.ensureRelations(repository.connection, dto, overrides);
        const transition = Transitions.create(dto);
        await repository.save(transition);
        return transition;
    }

    static async createTransitionWithNullState(
        repository,
        state = null,
        flow = null,
        nextState = null,
        id = null,
        ans_id = null
    ) {
        if (!repository) throw new Error('Invalid repository');

        const dto = {
            id: id ?? uuidv4(),
            estado_actual_id: state?.id?.value ?? null,
            siguiente_estado_id: nextState?.id?.value ?? uuidv4(),
            flujo_id: flow?.id?.value ?? uuidv4(),
            status: StatusEnum.ACTIVE.value,
            created_by: uuidv4(),
            created_at: new Date().toISOString(),
            ans_id: ans_id ?? uuidv4(),
        };

        // Misma regla que en `createTransition`: se garantizan SIEMPRE. `estado_actual_id`
        // es null salvo que llegue un `state` -de ahi el nombre del helper- y
        // `ensureParentRow` ignora los ids nulos, asi que incluirlo no cambia nada cuando
        // el test quiere justamente la transicion sin estado actual.
        await ensureParentRows(repository.connection, [
            { table: 'estados', id: dto.estado_actual_id },
            { table: 'estados', id: dto.siguiente_estado_id },
            { table: 'flujos', id: dto.flujo_id },
        ]);

        const transitions = Transitions.create(dto);
        await repository.save(transitions);
        return transitions;
    }

    static async createTransitionFullRelations(repository, overrides = {}) {
        const dto = TransitionsMother.dto(overrides);
        await TransitionsMother.ensureRelations(repository.connection, dto, overrides);
        const transitions = new Transitions(dto);
        await repository.save(transitions);
        return transitions;
    }
}
