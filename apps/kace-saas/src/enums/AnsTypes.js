export class AnsTypes {
    static MINUTES = new AnsTypes("MINUTES", "Minutes");
    static HOURS = new AnsTypes("HOURS", "Hours");
    static DAYS = new AnsTypes("DAYS", "Days");

    constructor (key, value) {
        this.#ensureIsValidMedition(value);

        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static fromValue (value) {
        if (value === "Minutes") {
            return AnsTypes.MINUTES;
        }
        if (value === "Hours") {
            return AnsTypes.HOURS;
        }
        if (value === "Days") {
            return AnsTypes.DAYS;
        }
        throw new Error("Invalid value");
    }

    #ensureIsValidMedition (value) {
        if (!value) {
            throw new Error("The value cannot be null");
        }
        if (value !== "Minutes" && value !== "Hours" && value !== "Days") {
            throw new Error(`The value must be a valid Medition: ${value}`);
        }
    }

    static toJson () {
        return {
            MINUTES: AnsTypes.MINUTES.value,
            HOURS: AnsTypes.HOURS.value,
            DAYS: AnsTypes.DAYS.value,
        };
    }
}
