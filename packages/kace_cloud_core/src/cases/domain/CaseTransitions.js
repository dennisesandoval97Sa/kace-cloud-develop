export class CaseTransitions {
    /** @type {KnexCaseRepository} is initialized in the constructor */
    #repository;

    /**
     *
     * @param {KnexCaseRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {object} originalAttributes attributes original of case
     * @param {object} newAttributes attributes changed in case
     * @param {string|null} transitionDate
     * @param {string|null} updatedById
     * @param {{ reasonCommentId: string|null, reason: string|null }|null} [reclassification] -
     *   AUD-1b: presente solo cuando la escritura que abrió este tramo fue una reclasificación.
     *   El timeline la pinta distinta y muestra su motivo, que llega ya resuelto (el repositorio
     *   lee los de todo el timeline en una sola consulta).
     * @param {object} [options]
     * @param {boolean} [options.includeState=true] - AUD-1c: en falso, deja `estado_actual` y
     *   `estado_siguiente` en `null` y no consulta `transiciones`. Es la mitad "reclasificación"
     *   de una escritura que reclasificó Y cambió de estado a la vez: esa escritura genera DOS
     *   entradas de timeline (ver `KnexCaseRepository#transformHistoryToTransitions`), y esta
     *   mitad no describe ningún estado —lo hace la otra, con `includeState` en su valor por
     *   defecto— para que el timeline no las muestre como el mismo hecho.
     * @returns {object}
     */

    async execute(
        originalAttributes,
        newAttributes,
        transitionDate = null,
        updatedById = null,
        reclassification = null,
        { includeState = true } = {}
    ) {
        const originalAtt =
            typeof originalAttributes === 'string' ? JSON.parse(originalAttributes) : originalAttributes;
        const newAtt = typeof newAttributes === 'string' ? JSON.parse(newAttributes) : newAttributes;

        let resolutionDate = '';
        let responsible = await this.#getLogin(newAtt.responsable_id ?? originalAtt.responsable_id);
        let groupName = await this.#getGroup(newAtt.grupo_id ?? originalAtt.grupo_id);
        let updatedBy = await this.#getLogin(updatedById ?? originalAtt.created_by);
        let currentState = null,
            nextState = null;
        if (includeState) {
            const transitionCase = await this.#getStates(newAtt.transicion_id ?? originalAtt.transicion_id);
            currentState = transitionCase.estado_actual;
            nextState = transitionCase.siguiente_estado;
        }

        if (newAtt['fecha_resolucion']) {
            resolutionDate = newAtt.fecha_resolucion;
        }

        return {
            actualizador: updatedBy.login,
            fecha: newAtt.updated_at ?? newAtt.created_at,
            fecha_transicion: transitionDate ?? null,
            responsable: responsible,
            grupo: groupName.nombre,
            estado_actual: currentState,
            estado_siguiente: nextState,
            fecha_resolucion: resolutionDate,
            update_source: newAtt.update_source ?? null,
            transicion_id: includeState ? (newAtt.transicion_id ?? null) : null,
            es_reclasificacion: reclassification != null,
            // El motivo es opcional: reclasificar sin comentario es válido, y entonces la línea
            // del timeline se marca igual pero sin texto. Llega ya resuelto desde el repositorio,
            // que los lee todos de una vez en vez de uno por tramo.
            motivo_reclasificacion: reclassification?.reason ?? null,
        };
    }

    async #getLogin(userId) {
        const user = await this.#repository.read
            .table('usuarios')
            .select('login', 'nombres', 'apellido1', 'apellido2')
            .where({ id: userId })
            .first();
        if (!user) return { login: '' };
        return user;
    }

    async #getGroup(groupId) {
        const group = await this.#repository.read.table('grupos').select('nombre').where({ id: groupId }).first();
        if (!group) return { nombre: '' };
        return group;
    }

    async #getStates(transitionId) {
        const transitions = await this.#repository.read
            .table('transiciones')
            .select(['estado_actual.nombre as estado_actual', 'estado_siguiente.nombre as siguiente_estado'])
            .leftJoin(
                `${this.#repository.qualifiedName('estados')} as estado_actual`,
                'estado_actual.id',
                'transiciones.estado_actual_id'
            )
            .leftJoin(
                `${this.#repository.qualifiedName('estados')} as estado_siguiente`,
                'estado_siguiente.id',
                'transiciones.siguiente_estado_id'
            )
            .where({ 'transiciones.id': transitionId })
            .first();

        if (!transitions) return { estado_actual: '', siguiente_estado: '' };
        return transitions;
    }
}
