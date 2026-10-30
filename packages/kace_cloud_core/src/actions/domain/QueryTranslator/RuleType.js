import { Helper, ValidationFailError } from '../../../shared';

export class RuleType {
    static MANUAL_INPUT = new RuleType('MANUAL_INPUT', 'manual_input');
    static OPTIONS_LIST = new RuleType('OPTIONS_LIST', 'options_list');
    static ENTITY = new RuleType('ENTITY', 'entity');
    static FUNCTION = new RuleType('FUNCTION', 'function');

    constructor(key, value) {
        this.#ensureIsValidRuleType(value);
        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static fromValue(value) {
        const map = {
            options_list: RuleType.OPTIONS_LIST,
            manual_input: RuleType.MANUAL_INPUT,
            entity: RuleType.ENTITY,
            function: RuleType.FUNCTION,
        };

        if (!map[value]) {
            Helper.logError(`Invalid rule type value: ${value}`);
            throw new ValidationFailError(`Invalid rule type: ${value}`, 'RuleType');
        }

        return map[value];
    }

    #ensureIsValidRuleType(value) {
        const validValues = new Set(['manual_input', 'entity', 'function', 'options_list']);
        if (!validValues.has(value)) {
            throw new Error(`The value must be a valid RuleType: ${value}`);
        }
    }

    static toJson() {
        const json = {};
        for (const key of Object.keys(RuleType)) {
            if (RuleType[key] instanceof RuleType) {
                json[key] = RuleType[key].value;
            }
        }
        return json;
    }
}
