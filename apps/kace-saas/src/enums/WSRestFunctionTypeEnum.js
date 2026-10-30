export class WSRestFunctionTypeEnum {
    static FORMAT_DATE = new WSRestFunctionTypeEnum("FORMAT_DATE", "formatDate");
    static DATE_DIFFERENCE = new WSRestFunctionTypeEnum("DATE_DIFFERENCE", "dateDifference");
    static TO_UPPER_CASE = new WSRestFunctionTypeEnum("TO_UPPER_CASE", "toUpperCase");
    static TO_LOWER_CASE = new WSRestFunctionTypeEnum("TO_LOWER_CASE", "toLowerCase");
    static TRIM = new WSRestFunctionTypeEnum("TRIM", "trim");
    static CONCATENATE = new WSRestFunctionTypeEnum("CONCATENATE", "concatenate");
    static CONCATENATE_COMMA = new WSRestFunctionTypeEnum("CONCATENATE_COMMA", "concatenateComma");
    static MASK_TEXT = new WSRestFunctionTypeEnum("MASK_TEXT", "maskText");
    static VALIDATE_UUID = new WSRestFunctionTypeEnum("VALIDATE_UUID", "isValidUUID");
    static GENERATE_UUID = new WSRestFunctionTypeEnum("GENERATE_UUID", "generateUUID");
    static INCREMENT = new WSRestFunctionTypeEnum("INCREMENT", "increment");
    static ENCRYPT = new WSRestFunctionTypeEnum("ENCRYPT", "encrypt");
    static FORMAT_NUMBER = new WSRestFunctionTypeEnum("FORMAT_NUMBER", "formatNumber");
    static FORMAT_TEXT = new WSRestFunctionTypeEnum("FORMAT_TEXT", "formatText");
    static VALIDATE_PHONE = new WSRestFunctionTypeEnum("VALIDATE_PHONE", "validatePhone");
    static VALIDATE_EMAIL = new WSRestFunctionTypeEnum("VALIDATE_EMAIL", "validateEmail");
    static FIND_NEW_ELEMENTS = new WSRestFunctionTypeEnum("FIND_NEW_ELEMENTS", "findNewElements");
    static CONVERT_TO_TIMEZONE = new WSRestFunctionTypeEnum("CONVERT_TO_TIMEZONE", "convertToTimezone");
    static REVERSE_ARRAY = new WSRestFunctionTypeEnum("REVERSE_ARRAY", "reverseArray");
    static CURRENT_DATE = new WSRestFunctionTypeEnum("CURRENT_DATE", "currentDate");
    static ADD_TO_CONTEXT = new WSRestFunctionTypeEnum("ADD_TO_CONTEXT", "addToContext");
    static MAP_PROPERTY = new WSRestFunctionTypeEnum("MAP_PROPERTY", "mapProperty");
    static REGEX_OR = new WSRestFunctionTypeEnum("REGEX_OR", "regexOr");
    static DIVIDE = new WSRestFunctionTypeEnum("DIVIDE", "divide");
    static SUBTRACT = new WSRestFunctionTypeEnum("SUBTRACT", "subtract");
    static ADD = new WSRestFunctionTypeEnum("ADD", "add");
    static ABS = new WSRestFunctionTypeEnum("ABS", "abs");
    static CEIL = new WSRestFunctionTypeEnum("CEIL", "ceil");
    static FLOOR = new WSRestFunctionTypeEnum("FLOOR", "floor");
    static ADD_MINUTES = new WSRestFunctionTypeEnum("ADD_MINUTES", "addMinutes");
    static ADD_HOURS = new WSRestFunctionTypeEnum("ADD_HOURS", "addHours");
    static ADD_DAYS = new WSRestFunctionTypeEnum("ADD_DAYS", "addDays");
    static SUBTRACT_MINUTES = new WSRestFunctionTypeEnum("SUBTRACT_MINUTES", "subtractMinutes");
    static SUBTRACT_HOURS = new WSRestFunctionTypeEnum("SUBTRACT_HOURS", "subtractHours");
    static SUBTRACT_DAYS = new WSRestFunctionTypeEnum("SUBTRACT_DAYS", "subtractDays");
    static FILTER_ARRAY = new WSRestFunctionTypeEnum("FILTER_ARRAY", "filterArray");
    static NORMALIZE_CHANNEL_HUB_RULE = new WSRestFunctionTypeEnum(
        "NORMALIZE_CHANNEL_HUB_RULE",
        "normalizeChannelHubRule",
    );
    static FILTER_ARRAY_ALL = new WSRestFunctionTypeEnum("FILTER_ARRAY_ALL", "filterArrayAll");
    static FILTER_ARRAY_IN = new WSRestFunctionTypeEnum("FILTER_ARRAY_IN", "filterArrayIn");
    static SELECT_ARRAY = new WSRestFunctionTypeEnum("SELECT_ARRAY", "selectArray");

    constructor(key, value) {
        this.#ensureIsValidFunctionType(value);
        this.key = key;
        this.value = value;
        Object.freeze(this);
    }

    #ensureIsValidFunctionType(value) {
        if (!value) {
            throw new Error(`The value must be a valid Rest Function value: ${value}`);
        }
    }

    static fromValue(value) {
        const values = Object.values(WSRestFunctionTypeEnum);
        const found = values.find((type) => type.value === value);
        if (!found) {
            throw new Error(`Invalid Rest Function value: ${value}`);
        }
        return found;
    }

    static toJson() {
        return Object.values(WSRestFunctionTypeEnum).reduce((accumulator, type) => {
            accumulator[type.key] = type.value;
            return accumulator;
        }, {});
    }
}
