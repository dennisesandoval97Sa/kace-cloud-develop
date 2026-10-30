import { EncryptionService } from './EncryptionService.js';

export class ListTablesDomain {
    /** @type {KnexFieldListRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Ejecuta la obtención y encriptación de la lista de tablas
     * @param {string} clientPubKeyB64 - Clave pública del cliente en base64
     * @returns {Promise<Object>} Objeto con las tablas serializadas y encriptadas
     */
    async execute(clientPubKeyB64) {
        const tables = await this.#repository.getAllTables();
        const encryptedTables = await EncryptionService.encryptForClient(clientPubKeyB64, tables);
        return encryptedTables;
    }
}
