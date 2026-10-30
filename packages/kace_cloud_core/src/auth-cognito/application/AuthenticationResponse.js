export class AuthenticationCognitoResponse {
    /** is initialized in the constructor */
    #permisions;
    /** is initialized in the constructor */
    #groups;
    /** is initialized in the constructor */
    #user;

    constructor(permisions, groups, user) {
        this.#permisions = permisions;
        this.#groups = groups;
        this.#user = user;
    }

    get user() {
        return this.#user;
    }

    toJson() {
        if (!this.#permisions || !this.#groups || !this.#user) return {};

        const { password, cognito_hash_data, session_id, session_key, ...user } = this.#user;

        return {
            data: {
                user: user,
                groups: this.#groups,
                permisions: this.#permisions,
            },
        };
    }
}
