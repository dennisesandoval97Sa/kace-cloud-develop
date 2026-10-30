import { ValidationFailError } from '../../shared/index.js';

export class ValidateEntityExists {
    constructor(repository) {
        this.repository = repository;
    }

    /**
     * Valida que la entidad exista en la base de datos
     * @param {string} entity - El nombre de la entidad a validar
     * @returns {Promise<void>} Una promesa que se resuelve si la entidad existe
     * @throws {ValidationFailError} Si la entidad no existe en la base de datos
     * @throws {QueryDBError} Si hay un error al consultar la base de datos
     */
    async execute(entity) {
        if (!entity || typeof entity !== 'string' || entity.trim() === '') {
            throw new ValidationFailError('entity name is required and must be a non-empty string');
        }

        const tables = await this.repository.getSchemaTables();

        if (!tables.includes(entity)) {
            throw new ValidationFailError(`entity "${entity}" does not exist in the database`);
        }
    }
}
