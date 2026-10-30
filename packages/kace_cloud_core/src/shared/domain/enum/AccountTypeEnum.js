export class AccountTypeEnum {
    static ACTIVE_DIRECTORY = new AccountTypeEnum('ACTIVE_DIRECTORY', 1);
    static SERVICE = new AccountTypeEnum('SERVICE', 2);

    constructor(key, value) {
        this.#ensureIsValidAccountType(value);
        this.key = key;
        this.value = value;
        Object.freeze(this);
    }

    #ensureIsValidAccountType(value) {
        if (!value) throw new Error(`Invalid value: ${value}`);
    }

    static fromValue(value) {
        if (value === 1) return AccountTypeEnum.ACTIVE_DIRECTORY;
        if (value === 2) return AccountTypeEnum.SERVICE;
        throw new Error(`Invalid value: ${value}`);
    }

    static toJson() {
        return {
            ACTIVE_DIRECTORY: AccountTypeEnum.ACTIVE_DIRECTORY.value,
            SERVICE: AccountTypeEnum.SERVICE.value,
        };
    }
}
