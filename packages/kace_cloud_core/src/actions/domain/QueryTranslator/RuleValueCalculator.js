import { NestedValueManager } from '../../../shared';
import createDayjsInstance from '../../../shared/factories/DayjsFactory.js';

const dayjs = createDayjsInstance({});

export class RuleValueCalculator {
    /**
     *
     * @param {RuleValue} ruleValue
     * @param {RuleType} ruleType
     * @param {object} context
     * @param {object} opts
     * @param {import('dayjs').Dayjs} [opts.evaluationNow] - Optional fixed "now" for deterministic evaluation
     * @returns
     */
    static calculate(ruleValue, ruleType, context = {}, opts = {}) {
        if (ruleType.value === 'function') {
            return this.#calculateFunctionValue(ruleValue.value, opts.evaluationNow);
        }

        if (ruleType.value === 'entity') {
            return this.#calculateEntityValue(ruleValue.value, context);
        }

        return ruleValue.value;
    }

    static #calculateFunctionValue(functionType, evaluationNow) {
        const now = evaluationNow ?? dayjs();

        const formatMap = {
            date: () => now.format('YYYY-MM-DD'),
            time: () => now.format('HH:mm:ss'),
            datetime: () => now.format('YYYY-MM-DDTHH:mm:ssZ'),
        };

        const formatter = formatMap[functionType];
        if (!formatter) {
            throw new Error(`Unsupported function type: ${functionType}`);
        }

        return formatter();
    }

    static #calculateEntityValue(value, context) {
        if (value === 'cases.estadoActual') value = 'estados.id';
        return NestedValueManager.getValue(context, value);
    }
}
