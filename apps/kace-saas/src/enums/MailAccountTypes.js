export class MailAccountsTypes {
    static MS_GRAPH_APPLICATION = new MailAccountsTypes("MS_GRAPH_APPLICATION", "ms_graph_application");
    static MS_GRAPH_USER = new MailAccountsTypes("MS_GRAPH_USER", "ms_graph_user");
    static GMAIL_APPLICATION = new MailAccountsTypes("GMAIL_APPLICATION", "gmail_application");
    static GMAIL_USER = new MailAccountsTypes("GMAIL_USER", "gmail_user");
    static SMTP = new MailAccountsTypes("SMTP", "smtp");

    constructor (key, value) {
        this.#ensureIsValidTypeMailAccount(value);

        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static fromValue (value) {
        for (const type of [
            MailAccountsTypes.MS_GRAPH_APPLICATION,
            MailAccountsTypes.MS_GRAPH_USER,
            MailAccountsTypes.GMAIL_APPLICATION,
            MailAccountsTypes.GMAIL_USER,
            MailAccountsTypes.SMTP,
        ]) {
            if (value === type.value) {
                return type;
            }
        }
        throw new Error(`Invalid value: ${value}`);
    }

    static toJson () {
        return {
            MS_GRAPH_APPLICATION: MailAccountsTypes.MS_GRAPH_APPLICATION.value,
            MS_GRAPH_USER: MailAccountsTypes.MS_GRAPH_USER.value,
            GMAIL_APPLICATION: MailAccountsTypes.GMAIL_APPLICATION.value,
            GMAIL_USER: MailAccountsTypes.GMAIL_USER.value,
            SMTP: MailAccountsTypes.SMTP.value,
        };
    }

    #ensureIsValidTypeMailAccount (value) {
        if (!value) {
            throw new Error("The value cannot be null");
        }

        const validValues = ["ms_graph_application", "ms_graph_user", "gmail_application", "gmail_user", "smtp"];

        if (!validValues.includes(value)) {
            throw new Error(`The value must be a valid Type: ${value}`);
        }
    }
}
