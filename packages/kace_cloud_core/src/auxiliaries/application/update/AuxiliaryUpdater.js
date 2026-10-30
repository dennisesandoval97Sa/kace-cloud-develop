import { ValidateEntityExists } from '../../domain/ValidateEntityExists.js';
import { ValidationFailError, ValueObjectUuid } from '../../../shared/index.js';
import { KnexAuxiliariesRepository } from '../../infrastructure/persistence/KnexAuxiliariesRepository.js';
import { checkUniqueFields } from '../../../shared/domain/services/checkUniqueFields.js';

export class AuxiliaryUpdater {
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
     * Actualiza un registro existente en una tabla auxiliar
     * @param {string} tableName - Nombre de la tabla donde se actualizará el registro
     * @param {string|number} id - ID del registro a actualizar
     * @param {object} dto - Datos a actualizar
     * @param {boolean} shouldOverrideArray - Indica si se debe sobrescribir el array de datos
     * @returns {Promise<void>}
     * @throws {ValidationFailError} Si la tabla no existe o los datos son inválidos
     */
    async execute(id, dto, tableName, shouldOverrideArray = false, dataStructure = null) {
        await this.#validateEntityExists.execute(tableName);

        if (!id) {
            throw new ValidationFailError('El ID no puede estar vacío', 'id');
        }

        if (!dto || Object.keys(dto).length === 0) {
            throw new ValidationFailError('Los datos no pueden estar vacíos', 'dto');
        }

        if (!dto.data || Object.keys(dto.data).length === 0) {
            throw new ValidationFailError('El item data no puede estar vacio', 'dto.data');
        }

        if (dataStructure && Object.keys(dataStructure).length > 0) {
            const violations = await checkUniqueFields(dataStructure, dto.data, this.#repository, tableName, { id });
            if (violations.length > 0) {
                throw new ValidationFailError(
                    `Duplicate value for unique field(s): ${violations.map((v) => `${v.path} ("${v.value}")`).join(', ')}`,
                    violations[0].path,
                    violations
                );
            }
        }

        const auxiliary = await this.#repository.find(new ValueObjectUuid('auxiliary_id', id), tableName);
        if (!auxiliary) {
            throw new ValidationFailError(`No existe un registro con el ID ${id}`, 'id');
        }

        const originalValues = auxiliary.toJson();

        auxiliary.update(dto, shouldOverrideArray);
        await this.#repository.update(auxiliary, tableName);
        await this.#repository.saveHistory(auxiliary, originalValues, tableName);
        auxiliary.flushChanges();
    }
}
