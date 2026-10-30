export class EmailSentStatusEnum {
    static SENT = new EmailSentStatusEnum('SENT', 'sent');
    static FAILED = new EmailSentStatusEnum('FAILED', 'failed');

    constructor(key, value) {
        this.#ensureIsValidModules(value);

        this.key = key;
        this.value = value;
        Object.freeze(this);
    }

    static toJson() {
        const result = {};
        for (const [key, type] of Object.entries(EmailSentStatusEnum)) {
            if (type instanceof EmailSentStatusEnum) {
                result[key] = type.value;
            }
        }
        return result;
    }

    static fromValue(value) {
        for (const type of Object.values(EmailSentStatusEnum)) {
            if (type instanceof EmailSentStatusEnum && value === type.value) {
                return type;
            }
        }
        throw new Error(`Invalid value: ${value}`);
    }

    #ensureIsValidModules(value) {
        const validValues = ['sent', 'failed'];
        if (!validValues.includes(value)) {
            throw new Error(`The value must be a valid Type: ${value}`);
        }
    }
}

const EmailSentStatus = {
    SENT: 'sent',
    FAILED: 'failed',
};
