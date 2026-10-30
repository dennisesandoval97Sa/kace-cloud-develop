import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { ValidationFailError } from '../../errors/ValidationFailError';
import { dateFunctions } from '../../../shared/calculator/functions/dateFunctions';
import { mathFunctions } from '../../../shared/calculator/functions/mathFunctions';
import { stringFunctions } from '../../../shared/calculator/functions/stringFunctions';
import { iif, utilityFunctions } from '../../../shared/calculator/functions/utilityFunctions';
import { comparatorFunctions } from '../../../shared/calculator/functions/comparatorFunctions';
import { Helper } from '../../index';

dayjs.extend(utc);
dayjs.extend(timezone);

export default class AutoCalculatedFields {
    /** @type {AuxCases} */
    #auxCase;
    get auxCase() {
        return this.#auxCase;
    }

    /** @type {VODataStructure} */
    #dataStructure;
    get dataStructure() {
        return this.#dataStructure;
    }

    constructor(auxCase, dataStructure) {
        this.#auxCase = auxCase;
        this.#dataStructure = dataStructure;
    }

    /**
     *
     * @param {string} contextType - "create" | "update"
     */

    execute(contextType) {
        const allCalculatedResults = {};
        const formsData = this.#auxCase?.data?.value;

        if (!formsData || Object.keys(formsData).length === 0) return {};

        for (const [formId, formValues] of Object.entries(formsData)) {
            let formSchema = this.#dataStructure.value[formId];

            if (!formSchema) {
                const isFlatFormat = this.#dataStructure.value?.data_structure === undefined;
                if (isFlatFormat) {
                    formSchema = {
                        type: 'object',
                        required: false,
                        data_structure: this.#dataStructure.value,
                    };
                } else {
                    continue;
                }
            }

            const fields = formSchema.data_structure;
            if (!fields) continue;

            const calculatedResults = {};
            this.#auxCase.fields = { ...formValues };

            this.#processFields(fields, formValues, calculatedResults, contextType, { ...formValues });

            Object.assign(this.#auxCase.data.value[formId], calculatedResults);
            allCalculatedResults[formId] = calculatedResults;
        }

        return allCalculatedResults;
    }

    #createEvaluationContext(fields, localContext) {
        const safeRef = (fieldName) => {
            if (localContext[fieldName] === undefined) {
                return undefined;
            }

            const value = localContext[fieldName];
            const fieldConfig = fields[fieldName];

            if (fieldConfig?.type === 'date' && fieldConfig?.timezone) {
                try {
                    const parsed = dayjs.tz(value, fieldConfig.timezone);
                    if (!parsed.isValid()) return value;
                    return parsed.utc().toISOString();
                } catch {
                    return value;
                }
            }

            return value;
        };

        return {
            ...dateFunctions,
            ...mathFunctions,
            ...stringFunctions,
            ...utilityFunctions,
            ...comparatorFunctions,
            ref: safeRef,
            iif,
        };
    }

    #validateAllowedFunctions(formula, fieldName) {
        const allowedFunctions = [
            ...Object.keys(dateFunctions),
            ...Object.keys(mathFunctions),
            ...Object.keys(stringFunctions),
            ...Object.keys(utilityFunctions),
            ...Object.keys(comparatorFunctions),
            'ref',
            'iif',
        ];

        const re = /\b([a-zA-Z_]\w*)\s*\(/g;
        let match;

        while ((match = re.exec(formula)) !== null) {
            let fnName = match[1];
            if (fnName === 'if') fnName = 'iif';
            if (!allowedFunctions?.includes(fnName)) {
                throw new ValidationFailError(
                    `Invalid function "${fnName}" in formula "${formula}" for field "${fieldName}"`
                );
            }
        }
    }

    /**
     * Evalúa una fórmula dentro de un contexto controlado.
     * @param {string} formula
     * @param {object} context
     * @returns {any}
     */
    #evaluateFormula(formula, context) {
        const formulaSafe = formula
            .replace(/\bref\s*\(\s*([a-zA-Z_]\w*)\s*\)/g, 'ref("$1")')
            .replace(/\bif\s*\(/g, 'iif(');

        const fieldRefs = [...formulaSafe.matchAll(/ref\("([^"]+)"\)/g)].map((m) => m[1]);

        const allowUndefinedFunctions = ['coalesce', 'iif', 'if'];

        const formulaLower = formulaSafe.toLowerCase();
        const usesAllowUndefined = allowUndefinedFunctions.some((fn) => formulaLower.includes(fn));

        if (!usesAllowUndefined) {
            for (const field of fieldRefs) {
                const value = context.ref(field);

                if (value === undefined || value === null || value === '') {
                    return null;
                }
            }
        }

        const funcNames = Object.keys(context);
        const funcValues = Object.values(context);

        const evaluator = new Function(...funcNames, `return (${formulaSafe});`);
        return evaluator(...funcValues);
    }

    #processFields(fields, formValues, calculatedResults, contextType, localContext) {
        for (const [fieldName, fieldConfig] of Object.entries(fields)) {
            if (fieldConfig.type === 'calculated') {
                const formula = fieldConfig.calc?.formula;
                const errorPolicy = fieldConfig.calc?.error_policy || 'error';
                const onEvents = fieldConfig.calc?.on || ['create', 'update'];

                if (!onEvents.includes(contextType)) {
                    if (errorPolicy === 'empty') {
                        calculatedResults[fieldName] = null;
                    }
                    continue;
                }
                try {
                    if (!formula) {
                        throw new ValidationFailError(`Missing formula for field "${fieldName}"`);
                    }

                    this.#validateAllowedFunctions(formula, fieldName);

                    const context = this.#createEvaluationContext(fields, localContext);
                    const value = this.#evaluateFormula(formula, context);

                    calculatedResults[fieldName] = value;

                    localContext[fieldName] = value;
                } catch (err) {
                    Helper.logError(err);
                    if (errorPolicy === 'error') throw err;
                    calculatedResults[fieldName] = null;
                }
            }

            if (fieldConfig.type === 'object' && fieldConfig.data_structure) {
                const nestedValues = formValues[fieldName] || {};
                const nestedResults = {};

                const nestedContext = {
                    ...localContext,
                    ...nestedValues,
                };

                this.#processFields(
                    fieldConfig.data_structure,
                    nestedValues,
                    nestedResults,
                    contextType,
                    nestedContext
                );

                if (!formValues[fieldName]) {
                    formValues[fieldName] = {};
                }

                Object.assign(formValues[fieldName], nestedResults);

                Object.assign(localContext, nestedResults);
            }
        }
    }
}
