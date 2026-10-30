import { InvalidArgumentError } from '../../shared/errors/InvalidArgumentError';
import { ValueObjectUuid } from '../../shared/domain/value-object/ValueObjectUuid';
import { Helper } from '../../shared';

export class Specifications {
    /**
     * @type {Array}
     * Represents the users as an array of UUIDs.
     * is initialized in the constructor
     */
    #users;

    /**
     * @type {Array}
     * Represents the groups as an array of UUIDs.
     * is initialized in the constructor
     */
    #groups;

    /**
     * @type {Array}
     * Represents the clients as an array of UUIDs.
     * is initialized in the constructor
     */
    #clients;

    /**
     * Creates an instance of the Specifications class.
     * @param {Object} dto - JSON object containing specifications.
     * @param {Array} value.users - Array of user UUIDs.
     * @param {Array} value.groups - Array of group UUIDs.
     * @param {Array} value.clients - Array of client UUIDs.
     * @throws {InvalidArgumentError} If no valid users, groups, or clients are provided.
     */
    constructor(dto) {
        const hasValidUsers = this.#validateArray(dto.users);
        const hasValidGroups = this.#validateArray(dto.groups);
        const hasValidClients = this.#validateArray(dto.clients);

        if (!hasValidUsers || !hasValidGroups || !hasValidClients) {
            Helper.logError(`At least one of users, groups, or clients must contain a valid UUID.`);
            throw new InvalidArgumentError('At least one of users, groups, or clients must contain a valid UUID.');
        }

        this.#users = dto.users ?? null;
        this.#groups = dto.groups ?? null;
        this.#clients = dto.clients ?? null;
    }

    /**
     * Validates that an array exists, has elements, and all elements are valid UUIDs.
     * @param {Array} arr - The array to validate.
     * @returns {boolean} True if the array is valid, false otherwise.
     */
    #validateArray(arr) {
        if (Array.isArray(arr) && arr.length > 0) {
            return arr.every((id) => {
                try {
                    new ValueObjectUuid('id', id);
                    return true;
                } catch {
                    return false;
                }
            });
        }
        return true;
    }

    /**
     * Gets the users.
     * @returns {Array} The array of user UUIDs.
     */
    get users() {
        return this.#users;
    }

    /**
     * Sets the users.
     * @param {Array} users - The new array of user UUIDs.
     * @throws {InvalidArgumentError} If the users array is not valid.
     */
    set users(users) {
        if (!this.#validateArray(users)) {
            Helper.logError(`Users must contain valid UUIDs.`);
            throw new InvalidArgumentError('Users must contain valid UUIDs.');
        }
        this.#users = users;
    }

    /**
     * Gets the groups.
     * @returns {Array} The array of group UUIDs.
     */
    get groups() {
        return this.#groups;
    }

    /**
     * Sets the groups.
     * @param {Array} groups - The new array of group UUIDs.
     * @throws {InvalidArgumentError} If the groups array is not valid.
     */
    set groups(groups) {
        if (!this.#validateArray(groups)) {
            Helper.logError(`Groups must contain valid UUIDs.`);
            throw new InvalidArgumentError('Groups must contain valid UUIDs.');
        }
        this.#groups = groups;
    }

    /**
     * Gets the clients.
     * @returns {Array} The array of client UUIDs.
     */
    get clients() {
        return this.#clients;
    }

    /**
     * Sets the clients.
     * @param {Array} clients - The new array of client UUIDs.
     * @throws {InvalidArgumentError} If the clients array is not valid.
     */
    set clients(clients) {
        if (!this.#validateArray(clients)) {
            Helper.logError(`Clients must contain valid UUIDs.`);
            throw new InvalidArgumentError('Clients must contain valid UUIDs.');
        }
        this.#clients = clients;
    }

    /**
     * Gets the value of the specifications.
     * @returns {Object} The value of the specifications.
     */
    get value() {
        return {
            users: this.#users,
            groups: this.#groups,
            clients: this.#clients,
        };
    }
}
