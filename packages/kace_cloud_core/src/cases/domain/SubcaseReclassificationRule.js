import { CASE_RECLASSIFY_SUBCASE_NOT_ALLOWED } from '@kace/error-codes';

/**
 * CORE-2 (MSKT-1392) — decide si un caso puede reclasificarse a una clasificación destino
 * sin romper la jerarquía de subcasos a la que pertenece.
 *
 * Es una regla PURA a propósito: el precheck (API-3) y el caso de uso (CORE-1) tienen que
 * devolver exactamente el mismo mensaje, y la única forma de garantizarlo es que ambos
 * consuman este resultado en vez de redactar el suyo. Quien lee de base de datos es el
 * llamador; aquí solo entran agregados ya cargados.
 *
 * Las dos situaciones que bloquean:
 *
 * 1. **El caso es un subcaso.** Su clasificación tiene que seguir siendo una de las que el
 *    flujo de clasificaciones del padre declara. Si no, el subcaso quedaría colgando de un
 *    padre que no lo reconoce.
 * 2. **El caso es un padre con subcasos.** La clasificación destino tiene que poder abrir
 *    flujo de subcasos (`can_start_sub_cases_flow`) y declarar las clasificaciones de los
 *    hijos que ya existen. Si no, los hijos vivos dejarían de ser alcanzables desde el padre.
 *
 * Un caso suelto —ni padre ni hijo— siempre es compatible.
 */
export class SubcaseReclassificationRule {
    /**
     * @typedef {Object} SubcaseReclassificationVerdict
     * @property {boolean} compatible
     * @property {string|null} code - Código de error público cuando no es compatible.
     * @property {string|null} message - Mensaje ya redactado, idéntico para precheck y use case.
     */

    /**
     * @param {Object} params
     * @param {import('../../classifications/domain/Classification.js').Classification} params.targetClassification
     *   Clasificación a la que se quiere mover el caso.
     * @param {import('../../classifications/domain/Classification.js').Classification|null} [params.parentClassification]
     *   Clasificación del caso padre, cuando el caso a reclasificar es un subcaso.
     * @param {string[]} [params.childClassificationIds]
     *   Clasificaciones de los subcasos vivos, cuando el caso a reclasificar es padre.
     * @returns {SubcaseReclassificationVerdict}
     */
    static evaluate({ targetClassification, parentClassification = null, childClassificationIds = [] }) {
        if (parentClassification) {
            const allowedByParent = new Set(parentClassification.getClassificationsIds());
            if (!allowedByParent.has(targetClassification.id.value)) {
                return SubcaseReclassificationRule.#reject(
                    'The target classification is not one of the subclassifications declared by the parent case classification.'
                );
            }
        }

        if (childClassificationIds.length > 0) {
            if (targetClassification.can_start_sub_cases_flow.value !== true) {
                return SubcaseReclassificationRule.#reject(
                    'The target classification cannot start a subcases flow, and the case already has subcases.'
                );
            }

            const declaredByTarget = new Set(targetClassification.getClassificationsIds());
            const orphaned = [...new Set(childClassificationIds)].filter((id) => !declaredByTarget.has(id));
            if (orphaned.length > 0) {
                return SubcaseReclassificationRule.#reject(
                    'The target classification does not declare the classifications of the existing subcases.'
                );
            }
        }

        return { compatible: true, code: null, message: null };
    }

    /**
     * @param {string} message
     * @returns {SubcaseReclassificationVerdict}
     */
    static #reject(message) {
        return { compatible: false, code: CASE_RECLASSIFY_SUBCASE_NOT_ALLOWED, message };
    }
}
