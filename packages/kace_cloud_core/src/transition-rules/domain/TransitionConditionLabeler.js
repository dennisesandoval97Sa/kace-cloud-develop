const USERS = 'users';
const GROUPS = 'groups';
const STATES = 'states';
const CLASSIFICATIONS = 'classifications';

const USER_COLUMNS = [
    'responsable_id',
    'created_by',
    'updated_by',
    'deleted_by',
    'closed_by',
    'reopen_by',
    'edited_by',
    'cloned_by',
];

/**
 * Campos de regla cuyo valor es el id de otra entidad. `casos` es el alias legado de `cases`
 * que `RuleValidator.PUBLISHABLE_FIELD_NAMESPACES` también publica.
 */
const ENTITY_BY_FIELD = Object.freeze({
    ...Object.fromEntries(
        USER_COLUMNS.flatMap((column) => [`cases.${column}`, `casos.${column}`].map((f) => [f, USERS]))
    ),
    'cases.grupo_id': GROUPS,
    'casos.grupo_id': GROUPS,
    'cases.estadoActual': STATES,
    'estados.id': STATES,
    'cases.clasificacion_id': CLASSIFICATIONS,
    'casos.clasificacion_id': CLASSIFICATIONS,
    'clasificaciones.id': CLASSIFICATIONS,
    'clasificaciones.description': CLASSIFICATIONS,
});

const OPERANDS = [
    ['expected', 'expected_label'],
    ['actual', 'actual_label'],
];

/**
 * Pone nombre a los ids que publica el diagnóstico de una regla de transición, para que el
 * asesor lea «Camilo Londoño» y no un uuid.
 *
 * Solo nombra operandos que el diagnóstico YA publica: uno omitido por la allowlist de
 * `RuleValidator` no se reintroduce con nombre.
 */
export class TransitionConditionLabeler {
    /**
     * @param {{ combinator: string|null, failed: Array<object> }|null} diagnostic
     * @param {{ findReferenceLabels: (idsByEntity: Object<string, string[]>) => Promise<Object<string, Object<string, string>>> }} labelsSource
     * @returns {Promise<{ combinator: string|null, failed: Array<object> }|null>}
     */
    static async label(diagnostic, labelsSource) {
        if (!Array.isArray(diagnostic?.failed)) return diagnostic;

        const idsByEntity = TransitionConditionLabeler.#collectIds(diagnostic.failed);
        if (Object.keys(idsByEntity).length === 0) return diagnostic;

        const labels = await labelsSource.findReferenceLabels(idsByEntity);

        return {
            ...diagnostic,
            failed: diagnostic.failed.map((condition) => TransitionConditionLabeler.#labelCondition(condition, labels)),
        };
    }

    static #collectIds(failed) {
        const idsByEntity = {};

        for (const condition of failed) {
            const entity = ENTITY_BY_FIELD[condition.field];
            if (!entity) continue;

            for (const [operand] of OPERANDS) {
                for (const id of TransitionConditionLabeler.#ids(condition[operand])) {
                    idsByEntity[entity] ??= [];
                    if (!idsByEntity[entity].includes(id)) idsByEntity[entity].push(id);
                }
            }
        }

        return idsByEntity;
    }

    static #labelCondition(condition, labels) {
        const entityLabels = labels?.[ENTITY_BY_FIELD[condition.field]];
        if (!entityLabels) return condition;

        const labeled = { ...condition };
        for (const [operand, labelKey] of OPERANDS) {
            const label = TransitionConditionLabeler.#labelOperand(condition[operand], entityLabels);
            if (label !== undefined) labeled[labelKey] = label;
        }

        return labeled;
    }

    /**
     * Una lista se nombra elemento a elemento y conserva el id del que no se encuentra, para que
     * siga alineada con `expected`/`actual`; si no se nombra ninguno, no hay etiqueta.
     */
    static #labelOperand(value, entityLabels) {
        if (Array.isArray(value)) {
            const labeled = value.map((id) => entityLabels[id] ?? id);
            return labeled.some((label, index) => label !== value[index]) ? labeled : undefined;
        }

        return typeof value === 'string' ? entityLabels[value] : undefined;
    }

    static #ids(value) {
        const values = Array.isArray(value) ? value : [value];
        return values.filter((id) => typeof id === 'string' && id !== '');
    }
}
