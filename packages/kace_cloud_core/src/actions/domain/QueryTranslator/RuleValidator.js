import { Helper, InvalidArgumentError } from '../../../shared';
import { CompositeRule } from '../QueryTranslator/CompositeRule';
import { Rule } from '../QueryTranslator/Rule';
import { RuleOperator } from '../QueryTranslator/RuleOperator';
import { RuleValueCalculator } from './RuleValueCalculator';
import { ValueComparator } from './ValueComparator';

export class RuleValidator {
    /**
     * Validates a rule or composite rule against a context object
     * @param {Rule|CompositeRule} rule - The rule to validate
     * @param {Object} context - The context object containing the values to validate against
     * @param {Case} kase Case to be validated
     * @param {object} opts
     * @param {import('dayjs').Dayjs} [opts.evaluationNow] - Optional fixed "now" for deterministic evaluation
     * @returns {boolean} - Whether the rule validates against the context
     */
    static validate(rule, context, kase, opts = {}) {
        if (!(rule instanceof CompositeRule || rule instanceof Rule)) {
            throw new InvalidArgumentError('Rule must be an instance of CompositeRule or Rule');
        }

        if (!context || typeof context !== 'object') {
            throw new InvalidArgumentError('Context must be a valid object');
        }

        if (rule instanceof CompositeRule) {
            return RuleValidator.validateCompositeRule(rule, context, kase, opts);
        }
        return RuleValidator.validateSimpleRule(rule, context, kase, opts);
    }

    /**
     * Validates a composite rule by evaluating all its child rules
     * @param {CompositeRule} compositeRule - The composite rule to validate
     * @param {Object} context - The context object containing the values
     * @param {Case} kase Case to be validated
     * @param {object} opts
     * @param {import('dayjs').Dayjs} [opts.evaluationNow] - Optional fixed "now" for deterministic evaluation
     * @returns {boolean} - Whether the composite rule validates
     */
    static validateCompositeRule(compositeRule, context, kase, opts = {}) {
        const results = compositeRule.rules.map((rule) => RuleValidator.validate(rule, context, kase, opts));

        if (compositeRule.combinator.value === 'and') {
            return results.every((result) => result === true);
        }

        if (compositeRule.combinator.value === 'or') {
            return results.some((result) => result === true);
        }

        throw new InvalidArgumentError(`Unsupported combinator: ${compositeRule.combinator.value}`);
    }

    /**
     *
     * @param {Rule} rule
     * @param {*} context
     * @param {Case} kase Case to be validated
     * @param {object} opts
     * @param {import('dayjs').Dayjs} [opts.evaluationNow] - Optional fixed "now" for deterministic evaluation
     * @returns
     */
    static validateSimpleRule(rule, context, kase, opts = {}) {
        Helper.logDebug2('validateSimpleRule begin', JSON.stringify(rule), context);

        const { fieldValue, ruleValue } = RuleValidator.resolveOperands(rule, context, kase, opts);

        const result = RuleValidator.validateOperator(fieldValue, ruleValue, rule.operator.value, rule.valueType);
        Helper.logDebug2(
            `validateOperator ${rule.operator.value} for field: ${rule.field.value} with value: ${fieldValue} and ruleValue: ${ruleValue} Result: ${result}`
        );
        return result;
    }

    /**
     * Resolves the two sides of a simple rule: the value read from the context and the value the
     * rule compares against. Shared by `validateSimpleRule` and `explain` so the diagnostic
     * reports exactly the operands the verdict was built from.
     *
     * @param {Rule} rule
     * @param {Object} context
     * @param {Case} [kase]
     * @param {object} [opts]
     * @returns {{ fieldValue: any, ruleValue: any }}
     */
    static resolveOperands(rule, context, kase, opts = {}) {
        const ruleValue = RuleValueCalculator.calculate(rule.value, rule.type, context, opts);

        if (kase && kase.VALID_TRANSITIONS_SLA_FIELDS && kase.VALID_TRANSITIONS_SLA_FIELDS.includes(rule.field.value)) {
            return { fieldValue: kase.slaFieldResolvers[rule.field.value](), ruleValue };
        }

        let ruleField = rule.field.value;
        if (
            !rule.field.value.startsWith('cases') &&
            !rule.field.value.startsWith('clients') &&
            !rule.field.value.startsWith('clasificaciones') &&
            !rule.field.value.startsWith('aux_cases') &&
            !rule.field.value.startsWith('aux_users') &&
            !rule.field.value.startsWith('estados')
        ) {
            const fullPathValue = RuleValidator.getFieldValue(rule.field.value, context);
            if (fullPathValue === undefined) {
                const arr = rule.field.value.split('.');
                ruleField = arr[arr.length - 1];
            }
        }

        return { fieldValue: RuleValidator.getFieldValue(ruleField, context), ruleValue };
    }

    /**
     * Same verdict as `validate`, plus which conditions produced it.
     *
     * Es un método APARTE a propósito: `validate` devuelve un booleano que consumen nueve
     * llamadores y no puede cambiar de forma. Aquí se repite la evaluación —los operandos salen
     * del mismo `resolveOperands`, así que el veredicto es el mismo— para poder nombrar cada
     * condición incumplida.
     *
     * `failed` recoge las condiciones que no se cumplen incluso cuando el combinador es `or` y
     * por tanto ninguna rama basta por sí sola: el consumidor necesita las alternativas, no una.
     * Las condiciones anidadas se aplanan: quien lo lee quiere la lista de bloqueos, no el árbol.
     *
     * @param {Rule|CompositeRule} rule
     * @param {Object} context
     * @param {Case} [kase]
     * @param {object} [opts]
     * @param {import('dayjs').Dayjs} [opts.evaluationNow]
     * @returns {{ satisfied: boolean, combinator: string|null, failed: Array<{ field: string, operator: string, value_type: string, expected: any, actual: any }> }}
     */
    static explain(rule, context, kase, opts = {}) {
        if (!(rule instanceof CompositeRule || rule instanceof Rule)) {
            throw new InvalidArgumentError('Rule must be an instance of CompositeRule or Rule');
        }

        if (!context || typeof context !== 'object') {
            throw new InvalidArgumentError('Context must be a valid object');
        }

        if (rule instanceof CompositeRule) {
            const results = rule.rules.map((child) => RuleValidator.explain(child, context, kase, opts));
            const combinator = rule.combinator.value;

            if (combinator !== 'and' && combinator !== 'or') {
                throw new InvalidArgumentError(`Unsupported combinator: ${combinator}`);
            }

            const satisfied =
                combinator === 'and'
                    ? results.every((result) => result.satisfied)
                    : results.some((result) => result.satisfied);

            return {
                satisfied,
                combinator,
                failed: satisfied ? [] : results.flatMap((result) => result.failed),
            };
        }

        const { fieldValue, ruleValue } = RuleValidator.resolveOperands(rule, context, kase, opts);
        const satisfied = RuleValidator.validateOperator(fieldValue, ruleValue, rule.operator.value, rule.valueType);

        return {
            satisfied,
            combinator: null,
            failed: satisfied ? [] : [RuleValidator.#failedCondition(rule, fieldValue, ruleValue)],
        };
    }

    /**
     * Namespaces del catálogo de campos cuyo VALOR puede viajar en el cuerpo de una respuesta
     * HTTP de rechazo.
     *
     * Es una allowlist, no una denylist: el catálogo lo amplía el tenant —`aux_cases`,
     * `aux_clients` y `aux_users` son JSON libre— y un namespace nuevo tiene que entrar aquí a
     * propósito, no colarse por omisión. Quedan fuera `clients` (datos personales del titular),
     * `aux_clients` y `aux_users` (datos de terceros) y `aux_cases` (contenido arbitrario del
     * tenant): nada de eso pertenece al alcance del asesor que intenta la transición.
     *
     * Dentro quedan el propio caso (`cases`/`casos`, que el asesor ya tiene delante en el
     * formulario) y los catálogos de configuración (`clasificaciones`, `estados`).
     */
    static PUBLISHABLE_FIELD_NAMESPACES = Object.freeze(['cases', 'casos', 'clasificaciones', 'estados']);

    /**
     * @param {string} fieldPath - Ruta del catálogo (`clients.nombre`, `casos.antiguedad_dias`…).
     * @returns {boolean}
     */
    static isPublishableField(fieldPath) {
        if (typeof fieldPath !== 'string' || fieldPath === '') return false;

        return RuleValidator.PUBLISHABLE_FIELD_NAMESPACES.includes(fieldPath.split('.')[0]);
    }

    /**
     * Condición incumplida tal y como puede publicarse.
     *
     * El campo, el operador y el tipo son configuración del administrador y siempre viajan: sin
     * ellos el diagnóstico no nombra nada. Los operandos solo viajan si su origen está en la
     * allowlist; cuando no, se OMITEN y la condición se marca `redacted`, porque un `actual: null`
     * sería indistinguible de un campo realmente vacío.
     *
     * `expected` se juzga por su propio origen: con `type: 'entity'` no es un literal configurado
     * sino otro campo del contexto, que puede ser justo el que no puede publicarse.
     *
     * @param {Rule} rule
     * @param {any} fieldValue
     * @param {any} ruleValue
     * @returns {{ field: string, operator: string, value_type: string, expected?: any, actual?: any, redacted?: boolean }}
     */
    static #failedCondition(rule, fieldValue, ruleValue) {
        const actualPublishable = RuleValidator.isPublishableField(rule.field.value);
        const expectedPublishable =
            rule.type?.value === 'entity' ? RuleValidator.isPublishableField(rule.value?.value) : true;

        return {
            field: rule.field.value,
            operator: rule.operator.value,
            value_type: rule.valueType,
            ...(expectedPublishable ? { expected: RuleValidator.publicOperand(ruleValue) } : {}),
            ...(actualPublishable ? { actual: RuleValidator.publicOperand(fieldValue) } : {}),
            ...(actualPublishable && expectedPublishable ? {} : { redacted: true }),
        };
    }

    /**
     * Reduce un operando a algo publicable en una respuesta HTTP. Los valores vienen del contexto
     * del caso, que puede traer objetos enteros o fechas, y el diagnóstico solo necesita que el
     * asesor reconozca el dato.
     *
     * @param {any} value
     * @returns {string|number|boolean|null|Array<string|number|boolean|null>}
     */
    static publicOperand(value) {
        const MAX_LENGTH = 200;
        const MAX_ITEMS = 20;

        if (value === null || value === undefined) return null;
        // El recorte aplica también a la cadena suelta: un campo de texto largo del caso es
        // justo lo que no debe volcarse entero en el cuerpo de un 400.
        if (typeof value === 'string') return value.slice(0, MAX_LENGTH);
        if (typeof value === 'number' || typeof value === 'boolean') return value;
        if (Array.isArray(value)) return value.slice(0, MAX_ITEMS).map((item) => RuleValidator.publicOperand(item));
        if (value instanceof Date) return value.toISOString();

        // `String(objeto)` da "[object Object]", que no le dice nada a quien lee el diagnóstico:
        // el contexto del caso trae objetos enteros (una fila auxiliar, un valor JSON) y lo que
        // el asesor necesita reconocer es el dato, no su tipo. Un objeto que no se pueda
        // serializar —cíclico— cae en la representación por defecto antes que romper el
        // diagnóstico, que es información añadida sobre un rechazo ya decidido.
        if (typeof value === 'object') {
            try {
                return JSON.stringify(value).slice(0, MAX_LENGTH);
            } catch {
                return String(value).slice(0, MAX_LENGTH);
            }
        }

        return String(value).slice(0, MAX_LENGTH);
    }

    /**
     * Validates the rule for various operators.
     *
     * @param {*} fieldValue - The field value to compare.
     * @param {*} ruleValue - The value from the rule to compare against.
     * @param {string} operator - The operator used in the rule.
     * @returns {boolean} - Returns true if the rule is valid for the operator, otherwise false.
     * @throws {InvalidArgumentError} - Throws an error if the operator is unsupported.
     */
    static validateOperator(fieldValue, ruleValue, operator, valueType = 'text') {
        if (operator === RuleOperator.NULL) {
            return fieldValue === null || fieldValue === undefined;
        }

        if (operator === RuleOperator.NOT_NULL) {
            return fieldValue !== null && fieldValue !== undefined;
        }

        if (operator === RuleOperator.IS_EMPTY) {
            return fieldValue === '';
        }

        if (operator === RuleOperator.IS_NOT_EMPTY) {
            return fieldValue !== '' && fieldValue !== null && fieldValue !== undefined;
        }

        if (fieldValue === undefined) {
            return false;
        }

        const processedFieldValue = ValueComparator.processValue(fieldValue, valueType);

        const isTypeNumberOrDate = valueType === 'number' || valueType === 'date';
        if (isTypeNumberOrDate && processedFieldValue === null) return false;

        let processedRuleValue = ruleValue;
        if (
            ![RuleOperator.IN, RuleOperator.NOT_IN, RuleOperator.BETWEEN, RuleOperator.NOT_BETWEEN].includes(operator)
        ) {
            processedRuleValue = ValueComparator.processValue(ruleValue, valueType);

            if (isTypeNumberOrDate && processedRuleValue === null) return false;
        }

        const operators = {
            [RuleOperator.EQUALS]: () =>
                ValueComparator.compareEquals(processedFieldValue, processedRuleValue, valueType),
            [RuleOperator.NOT_EQUALS]: () =>
                !ValueComparator.compareEquals(processedFieldValue, processedRuleValue, valueType),
            [RuleOperator.LESS_THAN]: () =>
                ValueComparator.compareLessThan(processedFieldValue, processedRuleValue, valueType),
            [RuleOperator.GREATER_THAN]: () =>
                ValueComparator.compareGreaterThan(processedFieldValue, processedRuleValue, valueType),
            [RuleOperator.LESS_THAN_EQUAL]: () =>
                ValueComparator.compareLessThanOrEqual(processedFieldValue, processedRuleValue, valueType),
            [RuleOperator.GREATER_THAN_EQUAL]: () =>
                ValueComparator.compareGreaterThanOrEqual(processedFieldValue, processedRuleValue, valueType),
            [RuleOperator.CONTAINS]: () => ValueComparator.compareContains(processedFieldValue, processedRuleValue),
            [RuleOperator.DOES_NOT_CONTAIN]: () =>
                !ValueComparator.compareContains(processedFieldValue, processedRuleValue),
            [RuleOperator.BEGINS_WITH]: () =>
                ValueComparator.compareBeginsWith(processedFieldValue, processedRuleValue),
            [RuleOperator.DOES_NOT_BEGIN_WITH]: () =>
                !ValueComparator.compareBeginsWith(processedFieldValue, processedRuleValue),
            [RuleOperator.ENDS_WITH]: () => ValueComparator.compareEndsWith(processedFieldValue, processedRuleValue),
            [RuleOperator.DOES_NOT_END_WITH]: () =>
                !ValueComparator.compareEndsWith(processedFieldValue, processedRuleValue),
            [RuleOperator.IN]: () => ValueComparator.compareIn(processedFieldValue, ruleValue, valueType),
            [RuleOperator.NOT_IN]: () => !ValueComparator.compareIn(processedFieldValue, ruleValue, valueType),
            [RuleOperator.BETWEEN]: () => ValueComparator.compareBetween(processedFieldValue, ruleValue, valueType),
            [RuleOperator.NOT_BETWEEN]: () =>
                !ValueComparator.compareBetween(processedFieldValue, ruleValue, valueType),
        };

        if (operators[operator]) {
            return operators[operator]();
        }

        throw new InvalidArgumentError(`Unsupported operator: ${operator}`);
    }

    /**
     * Gets a field value from the context object using dot notation for deep access
     * @param {string} field - The field path (e.g. "aux_casos.form1.city")
     * @param {Object} context - The context object
     * @returns {any} - The field value or undefined if the path doesn't exist
     */
    static getFieldValue(field, context) {
        if (!field) {
            throw new InvalidArgumentError('Field path cannot be empty');
        }

        if (field === 'cases.estadoActual') {
            field = 'estados.id';
        }

        if (field === 'clasificaciones.description') {
            field = 'clasificaciones.id';
        }

        const keys = field.split('.');

        const resolve = (currentContext, pathParts) => {
            if (!currentContext || pathParts.length === 0) {
                return currentContext;
            }

            const [key, ...rest] = pathParts;

            if (Array.isArray(currentContext)) {
                for (const item of currentContext) {
                    const result = resolve(item, pathParts);
                    if (result !== undefined) {
                        return result;
                    }
                }
                return undefined;
            }

            if (typeof currentContext === 'object' && key in currentContext) {
                return resolve(currentContext[key], rest);
            }

            return undefined;
        };

        return resolve(context, keys);
    }
}
