export class Encryptions {
    static TLS = new Encryptions('TLS', 'tls');
    static SSL = new Encryptions('SSL', 'ssl');

    constructor(key, value) {
        this.#ensureIsValidTypeMailAccount(value);

        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static fromValue(value) {
        if (value === 'tls') {
            return Encryptions.TLS;
        }
        if (value === 'ssl') {
            return Encryptions.SSL;
        }
        throw new Error('Invalid value');
    }

    static toJson() {
        return {
            TLS: Encryptions.TLS.value,
            SSL: Encryptions.SSL.value,
        };
    }

    #ensureIsValidTypeMailAccount(value) {
        if (!value) {
            throw new Error('The value cannot be null');
        }
        if (value !== 'tls' && value !== 'ssl') {
            throw new Error(`The value must be a valid Type: ${value}`);
        }
    }
}
