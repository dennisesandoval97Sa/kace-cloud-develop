/**
 * API-RULES (MSKT-1392) — las reglas que condicionan las transiciones del flujo de una
 * clasificación.
 *
 * Acompaña a `ClassificationFlowStatesFinder`: aquella dice a qué estados se puede llegar, ésta
 * con qué condiciones. El plugin las necesita para anticipar el bloqueo —avisar antes de que el
 * asesor elija un estado que la regla va a rechazar— en vez de descubrirlo al guardar.
 *
 * Una transición sin regla no aparece: no tiene nada que condicionar.
 */
export class ClassificationFlowTransitionRulesFinder {
    /** @type {import('../../infrastructure/persistence/KnexTransitionsCaseRepository.js').KnexTransitionsCaseRepository} */
    #transitionsCaseRepository;

    /**
     * @param {import('../../infrastructure/persistence/KnexTransitionsCaseRepository.js').KnexTransitionsCaseRepository} transitionsCaseRepository
     */
    constructor(transitionsCaseRepository) {
        this.#transitionsCaseRepository = transitionsCaseRepository;
    }

    /**
     * @param {import('../../../classifications/domain/Classification.js').Classification} classification
     * @returns {Promise<Array<{ transicion_id: string, rule_id: string, nombre: string }>>}
     */
    async executeForClassification(classification) {
        return this.#transitionsCaseRepository.findTransitionRulesByFlowId(classification.flujo_id.value);
    }
}
