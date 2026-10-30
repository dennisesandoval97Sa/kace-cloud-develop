import { ValidateEntityExists } from '../../domain/ValidateEntityExists.js';
import { ValidationFailError } from '../../../shared/index.js';
import { KnexAuxiliariesRepository } from '../../infrastructure/persistence/KnexAuxiliariesRepository.js';
import { Auxiliary } from '../../domain/Auxiliary.js';
import { AuxiliaryResponse } from '../AuxiliaryResponse.js';
import { checkUniqueFields } from '../../../shared/domain/services/checkUniqueFields.js';

export class AuxiliaryCreator {
    /** @type {KnexAuxiliariesRepository} */
    #repository;
    /** @type {ValidateEntityExists} */
    #validateEntityExists;

    /**
     * @param {KnexAuxiliariesRepository} repository - Repositorio para operaciones de auxiliares
     */
    constructor(repository) {
        this.#repository = repository;
        this.#validateEntityExists = new ValidateEntityExists(repository);
    }

    /**
     * Crea un nuevo registro en una tabla auxiliar
     * @param {string} tableName - Nombre de la tabla donde se creará el registro
     * @param {object} data - Datos a guardar en la tabla
     * @returns {Promise<void>}
     * @throws {ValidationFailError} Si la tabla no existe o los datos no son válidos
     */
    async execute(data, tableName, dataStructure = null) {
        await this.#validateEntityExists.execute(tableName);

        if (!data || Object.keys(data).length === 0) {
            throw new ValidationFailError('Los datos no pueden estar vacíos', 'data');
        }

        if (dataStructure && Object.keys(dataStructure).length > 0) {
            const violations = await checkUniqueFields(dataStructure, data.data, this.#repository, tableName, null);
            if (violations.length > 0) {
                throw new ValidationFailError(
                    `Duplicate value for unique field(s): ${violations.map((v) => `${v.path} ("${v.value}")`).join(', ')}`,
                    violations[0].path,
                    violations
                );
            }
        }

        const auxiliary = new Auxiliary(data);

        const newRecord = await this.#repository.save(auxiliary, tableName);
        await this.#repository.saveHistory(auxiliary, null, tableName);

        return new AuxiliaryResponse(newRecord);
    }
}
