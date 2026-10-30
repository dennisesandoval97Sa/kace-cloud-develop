import {
    CASE_RECLASSIFY_CASE_CLOSED,
    CASE_RECLASSIFY_CLASSIFICATION_INACTIVE,
    CASE_RECLASSIFY_CLASSIFICATION_NOT_IN_GROUP,
    CASE_RECLASSIFY_CLASSIFICATION_STALE,
    CASE_RECLASSIFY_CLASSIFICATION_WITHOUT_FORM,
    CASE_RECLASSIFY_DISABLED,
    CASE_RECLASSIFY_PARENT_UNVERIFIABLE,
    CASE_RECLASSIFY_TRANSITION_OUT_OF_FLOW,
} from '@kace/error-codes';
import { ValueObjectUuid } from '../../../shared/index.js';
import { CaseFinder as DomainCaseFinder } from '../../domain/CaseFinder.js';
import { SubcaseReclassificationRule } from '../../domain/SubcaseReclassificationRule.js';
import { isCaseReclassificationEnabled } from './isCaseReclassificationEnabled.js';

/**
 * Condiciones para mover un caso a otra clasificación. Devuelve veredicto en vez de lanzar
 * porque tiene dos consumidores: `CaseReclassifier` lanza en el primer bloqueo y el precheck
 * lo reporta. Si cada uno redactara sus reglas, se desincronizarían y el precheck diría que sí
 * a algo que el POST rechaza.
 *
 * Un solo bloqueo y no una lista: las comprobaciones dependen unas de otras, así que se corta
 * en la primera.
 */
export class CaseReclassificationEligibility {
    #classificationsRepository;
    #classificationGroupRelationshipRepository;
    #transitionsCaseRepository;
    #subcaseRelationshipRepository;
    #getGlobalConfig;
    #readCase;

    /**
     * @param {Object} dependencies
     * @param {import('../../infrastructure/persistence/KnexCaseRepository.js').KnexCaseRepository} dependencies.caseRepository
     * @param {import('../../../classifications/infrastructure/persistence/KnexClassificationsRepository.js').KnexClassificationRepository} dependencies.classificationsRepository
     * @param {import('../../../classification-group-relationships/infrastructure/persistence/KnexClassificationGroupRelationshipRepository.js').KnexClassificationGroupRelationshipRepository} dependencies.classificationGroupRelationshipRepository
     * @param {import('../../infrastructure/persistence/KnexTransitionsCaseRepository.js').KnexTransitionsCaseRepository} dependencies.transitionsCaseRepository
     * @param {import('../../infrastructure/persistence/KnexSubcaseRelationshipRepository.js').KnexSubcaseRelationshipRepository} dependencies.subcaseRelationshipRepository
     * @param {() => Promise<object>} dependencies.getGlobalConfig - Fuente de `allow_case_reclassification`.
     * @param {boolean} [dependencies.replicaSafeCaseRead=false] - `true` solo para el consumidor
     */
    constructor({
        caseRepository,
        classificationsRepository,
        classificationGroupRelationshipRepository,
        transitionsCaseRepository,
        subcaseRelationshipRepository,
        getGlobalConfig,
        replicaSafeCaseRead = false,
    }) {
        if (typeof getGlobalConfig !== 'function') {
            throw new Error('CaseReclassificationEligibility: getGlobalConfig is required');
        }
        this.#classificationsRepository = classificationsRepository;
        this.#classificationGroupRelationshipRepository = classificationGroupRelationshipRepository;
        this.#transitionsCaseRepository = transitionsCaseRepository;
        this.#subcaseRelationshipRepository = subcaseRelationshipRepository;
        this.#getGlobalConfig = getGlobalConfig;

        const finder = new DomainCaseFinder(caseRepository);
        this.#readCase = replicaSafeCaseRead
            ? (caseId) => caseRepository.findReadOnly(new ValueObjectUuid('id', caseId))
            : (caseId) => finder.execute(caseId);
    }

    /**
     * @typedef {Object} ReclassificationBlocker
     * @property {string} message
     * @property {number} statusCode
     * @property {string|null} code - `null` en los 404 genéricos.
     */

    /**
     * @typedef {Object} ReclassificationVerdict
     * @property {boolean} eligible
     * @property {ReclassificationBlocker|null} blocker
     * @property {import('../../domain/Case.js').Case|null} kase
     * @property {import('../../../classifications/domain/Classification.js').Classification|null} classification
     */

    /**
     * @param {string} caseId
     * @param {Object} params
     * @param {string} params.clasificacionId - Clasificación destino.
     * @param {string} [params.transicionId] - Sin ella se omite la comprobación de pertenencia
     *   al flujo: el precheck pregunta antes de que el asesor haya elegido estado.
     * @param {string} [params.grupoId] - Por defecto, el del caso.
     * @param {string} [params.clasificacionSnapshot] - Clasificación que el formulario tenía
     *   cargada, para el control de concurrencia.
     * @returns {Promise<ReclassificationVerdict>}
     */
    async evaluate(caseId, { clasificacionId, transicionId, grupoId, clasificacionSnapshot } = {}) {
        if (!isCaseReclassificationEnabled(await this.#getGlobalConfig())) {
            return CaseReclassificationEligibility.#reject(
                'Case reclassification is disabled in the global configuration.',
                403,
                CASE_RECLASSIFY_DISABLED
            );
        }

        const kase = await this.#readCase(caseId);

        if (kase === null) {
            return CaseReclassificationEligibility.#reject('The Case you are trying to reclassify does not exist', 404);
        }

        const caseBlocker = CaseReclassificationEligibility.#checkCase(kase, clasificacionSnapshot);
        if (caseBlocker) {
            return { eligible: false, blocker: caseBlocker, kase, classification: null };
        }

        // `skipCache`: de esta lectura sale el veredicto `is_active`, y el caché de clasificaciones
        // sirve datos de hasta 60 s. Una clasificación recién desactivada seguiría aceptándose como
        // destino durante ese rato, y la reclasificación es un cambio que arrastra flujo, estado y
        // formulario: no es un destino que convenga conceder por inercia del caché.
        const classification = await this.#classificationsRepository.find(
            new ValueObjectUuid('clasificacion_id', clasificacionId),
            { skipCache: true }
        );

        if (!classification) {
            return CaseReclassificationEligibility.#reject('Classification not found', 404, null, kase);
        }

        if (classification.is_active.value !== true) {
            return CaseReclassificationEligibility.#reject(
                'The target classification is not active.',
                400,
                CASE_RECLASSIFY_CLASSIFICATION_INACTIVE,
                kase,
                classification
            );
        }

        // `||` y no `??`: el esquema acepta `grupo_id: ''` («no cambio de grupo»), y pasarlo tal
        // cual construiría un `ValueObjectUuid` vacío, que lanza un `Error` plano —500— en vez de
        // evaluar la clasificación contra el grupo que el caso ya tiene.
        const groupBlocker = await this.#checkGroupAvailability(classification, grupoId || kase.grupo_id.value);
        if (groupBlocker) {
            return { eligible: false, blocker: groupBlocker, kase, classification };
        }

        if (transicionId !== undefined) {
            const transitionBlocker = await this.#checkTransitionBelongsToFlow(transicionId, classification);
            if (transitionBlocker) {
                return { eligible: false, blocker: transitionBlocker, kase, classification };
            }
        }

        const subcaseBlocker = await this.#checkSubcaseCompatibility(caseId, classification);
        if (subcaseBlocker) {
            return { eligible: false, blocker: subcaseBlocker, kase, classification };
        }

        return { eligible: true, blocker: null, kase, classification };
    }

    /**
     * Un caso cerrado no se reclasifica: su flujo terminó y el SLA está congelado.
     *
     * El snapshot obsoleto es un error y no el warning con el que `/cases/auxiliary` degrada el
     * mismo conflicto: allí se pierde un campo, aquí el formulario entero.
     *
     * @returns {ReclassificationBlocker|null}
     */
    static #checkCase(kase, clasificacionSnapshot) {
        if (kase.fecha_resolucion?.value) {
            return {
                message: 'The case is already resolved; it cannot be reclassified.',
                statusCode: 409,
                code: CASE_RECLASSIFY_CASE_CLOSED,
            };
        }

        // `!= null` y no `!== undefined`: el esquema acepta `current_clasificacion_id: null`
        // («no traigo snapshot»), y tratarlo como un snapshot real lo haría chocar siempre contra
        // la clasificación persistida, devolviendo un 409 del que el cliente no puede salir.
        if (clasificacionSnapshot != null && clasificacionSnapshot !== kase.clasificacion_id.value) {
            return CaseReclassificationEligibility.classificationStaleBlocker();
        }

        return null;
    }

    /**
     * El conflicto de concurrencia sobre la clasificación, con su único texto y su único código.
     *
     * Lo produce este pre-check leyendo el caso, y también `CaseReclassifier` cuando el CAS de la
     * escritura no encuentra el snapshot: son el MISMO conflicto detectado en dos instantes, y el
     * cliente tiene que recibir exactamente la misma respuesta en ambos o no puede tratarlo con
     * una sola rama.
     *
     * @returns {ReclassificationBlocker}
     */
    static classificationStaleBlocker() {
        return {
            message: 'The case classification changed after the form was loaded; reload the case before reclassifying.',
            statusCode: 409,
            code: CASE_RECLASSIFY_CLASSIFICATION_STALE,
        };
    }

    /**
     * `classification_group_relationships.form` es nullable: sin él el asesor llegaría a un
     * formulario inexistente.
     *
     * @returns {Promise<ReclassificationBlocker|null>}
     */
    async #checkGroupAvailability(classification, groupId) {
        const relationship = await this.#classificationGroupRelationshipRepository.find(
            classification.id,
            new ValueObjectUuid('grupo_id', groupId)
        );

        if (!relationship) {
            return {
                message: 'The target classification is not available for the case group.',
                statusCode: 400,
                code: CASE_RECLASSIFY_CLASSIFICATION_NOT_IN_GROUP,
            };
        }

        if (!relationship.form?.value) {
            return {
                message: 'The target classification has no form configured for the case group.',
                statusCode: 400,
                code: CASE_RECLASSIFY_CLASSIFICATION_WITHOUT_FORM,
            };
        }

        return null;
    }

    /**
     * @returns {Promise<ReclassificationBlocker|null>}
     */
    async #checkTransitionBelongsToFlow(transitionId, classification) {
        const transition = await this.#transitionsCaseRepository.findById(transitionId);

        if (!transition) {
            return { message: 'Transition not found', statusCode: 404, code: null };
        }

        if (transition.flujo_id !== classification.flujo_id.value) {
            return {
                message: 'The provided transition does not belong to the target classification flow.',
                statusCode: 400,
                code: CASE_RECLASSIFY_TRANSITION_OUT_OF_FLOW,
            };
        }

        return null;
    }

    /**
     * @returns {Promise<ReclassificationBlocker|null>}
     */
    async #checkSubcaseCompatibility(caseId, classification) {
        const parentCaseId = await this.#subcaseRelationshipRepository.findParentCaseId(caseId);
        let parentClassification = null;

        if (parentCaseId) {
            const parentCase = await this.#readCase(parentCaseId);
            // `skipCache`: el caché de clasificaciones guarda también el `null`, durante 60 s y por
            // instancia Lambda. Justo el escenario que dispara este bloqueo —la réplica que aún no
            // replicó al padre— dejaría ese `null` fijado, y el reintento que promete el mensaje
            // volvería a fallar contra el valor cacheado en vez de contra la base. Es una lectura
            // de baja frecuencia: no vale la pena cachearla.
            parentClassification = parentCase
                ? await this.#classificationsRepository.find(parentCase.clasificacion_id, { skipCache: true })
                : null;

            // Fail-closed: si el caso ES subcaso pero no se puede resolver la clasificación del
            // padre, `SubcaseReclassificationRule` no llega a evaluar la regla 1 y dejaría pasar
            // CUALQUIER destino, colgando el subcaso de un padre que no lo declara. El padre
            // borrado no cae aquí —`find` no filtra `deleted_at`—, así que esto solo se dispara
            // cuando la fila no es legible: réplica sin replicar todavía, o jerarquía huérfana.
            if (!parentClassification) {
                return {
                    message:
                        'The parent case of this subcase could not be verified. ' +
                        'If retrying in a few seconds does not help, its hierarchy needs to be reviewed.',
                    statusCode: 409,
                    code: CASE_RECLASSIFY_PARENT_UNVERIFIABLE,
                };
            }
        }

        const childClassificationIds = await this.#subcaseRelationshipRepository.findOpenChildClassificationIds(caseId);

        const verdict = SubcaseReclassificationRule.evaluate({
            targetClassification: classification,
            parentClassification,
            childClassificationIds,
        });

        if (verdict.compatible) {
            return null;
        }

        return { message: verdict.message, statusCode: 400, code: verdict.code };
    }

    /**
     * @returns {ReclassificationVerdict}
     */
    static #reject(message, statusCode, code = null, kase = null, classification = null) {
        return { eligible: false, blocker: { message, statusCode, code }, kase, classification };
    }
}
