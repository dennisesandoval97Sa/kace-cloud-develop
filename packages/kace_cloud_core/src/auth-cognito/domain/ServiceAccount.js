export class ServiceAccount {
    #username; // is initialized in the constructor
    #password; // is initialized in the constructor

    constructor({ username, password }) {
        this.#username = username;
        this.#password = password;
    }

    get username() {
        return this.#username;
    }

    get password() {
        return this.#password;
    }
}
