import { ServiceAccount } from '../domain/ServiceAccount.js';

export class AuthServiceAccount {
    /** @type {Idp} */
    #idp; // is initialized in the constructor

    /**
     * @param { Idp } idp
     */
    constructor(idp) {
        this.#idp = idp;
    }

    async execute(dto) {
        const serviceAccount = new ServiceAccount(dto);

        return await this.#idp.authenticate(serviceAccount);
    }
}
