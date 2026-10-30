export class Protocols {
    static SMTP = new Protocols("SMTP", "smtp");

    constructor (key, value) {
        this.#ensureIsValidTypeMailAccount(value);

        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static fromValue (value) {
        if (value === "smtp") {
            return Protocols.SMTP;
        }
        throw new Error("Invalid value");
    }

    static toJson () {
        return {
            SMTP: Protocols.SMTP.value,
        };
    }

    #ensureIsValidTypeMailAccount (value) {
        if (!value) {
            throw new Error("The value cannot be null");
        }
        if (value !== "smtp") {
            throw new Error(`The value must be a valid Type: ${value}`);
        }
    }
}
