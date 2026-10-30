import { SchemaFinder } from '../../domain/SchemaFinder.js';
import { SchemaResponse } from '../SchemaResponse.js';

export class SchemaFinderService {
    /**
     * @param {KnexSchemasRepository} repository
     */
    constructor(repository) {
        this.finder = new SchemaFinder(repository);
    }

    /**
     * Busca un Schema por su ID y retorna una respuesta estándar.
     * @param {string} id
     * @returns {Promise<SchemaResponse>}
     */
    async execute(id) {
        const schema = await this.finder.execute(id);
        return new SchemaResponse(schema);
    }

    async executeIfActive(id) {
        const schema = await this.finder.executeIfActive(id);
        return new SchemaResponse(schema);
    }
}
