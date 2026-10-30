import { CustomError } from '../../../shared/errors/CustomError.js';
import { ValueObjectUuid } from '../../../shared/index.js';
import { AvailableStatesCollectionsResponse } from '../../index.js';

/**
 * CORE-4 (MSKT-1392) — estados alcanzables del flujo de una clasificación.
 *
 * Es lo que `POST /transitions/search` no puede dar: ese endpoint no admite filtrar por
 * `is_visible`, exige `TransitionsRead` del namespace `administrador` —que un asesor no
 * tiene— y no permite joinear `estados` para traer los nombres.
 *
 * Responde la lista COMPLETA del flujo, sin depender del estado actual del caso: tras
 * reclasificar, el caso todavía está en un estado del flujo anterior, así que cualquier
 * consulta anclada a él saldría vacía.
 *
 * La respuesta reutiliza `AvailableStatesCollectionsResponse` a propósito: el servicio de
 * precheck (API-3) clona `case_available_states`, y el plugin resuelve la transición destino
 * a partir del estado elegido, para lo cual necesita el par estado↔transición que esa
 * respuesta ya publica.
 */
export class ClassificationFlowStatesFinder {
    /** @type {import('../../../classifications/infrastructure/persistence/KnexClassificationsRepository.js').KnexClassificationsRepository} */
    #classificationsRepository;

    /** @type {import('../../infrastructure/persistence/KnexTransitionsCaseRepository.js').KnexTransitionsCaseRepository} */
    #transitionsCaseRepository;

    /**
     * @param {import('../../../classifications/infrastructure/persistence/KnexClassificationsRepository.js').KnexClassificationsRepository} classificationsRepository
     * @param {import('../../infrastructure/persistence/KnexTransitionsCaseRepository.js').KnexTransitionsCaseRepository} transitionsCaseRepository
     */
    constructor(classificationsRepository, transitionsCaseRepository) {
        this.#classificationsRepository = classificationsRepository;
        this.#transitionsCaseRepository = transitionsCaseRepository;
    }

    /**
     * @param {string} classificationId
     * @returns {Promise<AvailableStatesCollectionsResponse>}
     */
    async execute(classificationId) {
        const classification = await this.#classificationsRepository.find(
            new ValueObjectUuid('clasificacion_id', classificationId)
        );

        if (!classification) {
            throw new CustomError('Classification not found', 404);
        }

        return this.executeForClassification(classification);
    }

    /**
     * Para quien ya tiene la clasificación en la mano —el precheck la recibe en el veredicto de
     * `CaseReclassificationEligibility`— y no necesita volver a leerla.
     *
     * @param {import('../../../classifications/domain/Classification.js').Classification} classification
     * @returns {Promise<AvailableStatesCollectionsResponse>}
     */
    async executeForClassification(classification) {
        const states = await this.#transitionsCaseRepository.findStatesByFlowId(classification.flujo_id.value);

        return new AvailableStatesCollectionsResponse(states);
    }
}
