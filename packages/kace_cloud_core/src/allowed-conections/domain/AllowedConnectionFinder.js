import { ValueObjectUuid } from '../../shared/index.js';
import { ValueObjectConnection } from './ValueObjectConnection.js';

export class AllowedConnectionFinder {
    /** @type {KnexAllowedConnectionsRepository} is initialized in the constructor */
    #repository;

    /**
     * Constructs a new instance of AllowedConnectionFinder.
     * @param {KnexAllowedConnectionsRepository} repository - The repository used to find allowed connections.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Executes the operation to find a allowed connection by its ID.
     * @param {string} id - The unique identifier of the allowed connection.
     * @returns {Promise<AllowedConnection | null>} A promise that resolves to the found allowed connection, or null if not found.
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }

    /**
     * Executes the operation to find a allowed connection by its connection value.
     * @param {string} connection - The connection string to search for.
     * @returns {Promise<AllowedConnection | null>} A promise that resolves to the found allowed connection, or null if not found.
     */
    async executeByConnection(connection) {
        return this.#repository.findByConnection(new ValueObjectConnection('connection', connection));
    }
}
