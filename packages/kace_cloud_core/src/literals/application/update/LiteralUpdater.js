import { DomainLiteralFinder, ValidationService } from '../../index.js';
import { CustomError, InvalidArgumentError } from '../../../shared/index.js';
import { LITERAL_TYPE_NOT_FOUND } from '@kace/error-codes';

export class LiteralUpdater {
    /** @type {DomainLiteralFinder} is initialized in the constructor */
    #literalFinder;
    /** @type {ValidationService} is initialized in the constructor */
    #validationService;
    /** @type {KnexLiteralRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of `LiteralUpdater`.
     *
     * @param {KnexLiteralRepository} repository - The repository used to access the `Literal` data.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#validationService = new ValidationService(repository);
        this.#literalFinder = new DomainLiteralFinder(repository);
    }

    /**
     * Executes the update operation for a `Literal` object in the repository.
     *
     * @param {string} id - The unique identifier of the `Literal` object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the `Literal` object.
     * @returns {Promise<void>} A promise that resolves when the `Literal` object is successfully updated.
     */
    async execute(id, dto) {
        const literal = await this.#literalFinder.execute(id);

        if (!literal) {
            throw new CustomError(`Literal with ID ${id} does not exist.`, 404);
        }

        if (dto.nombre && !literal.tipo_literal.value) {
            await this.#validationService.validateLiteralNameUnique(dto.nombre);
            await this.#validationService.validateEntityExists(dto.nombre);
        }

        if (dto.tipo_literal) {
            const typeLiteral = await this.#literalFinder.execute(dto.tipo_literal);
            if (!typeLiteral) {
                throw new InvalidArgumentError(
                    `Type of Literal ${dto.tipo_literal} does not exist.`,
                    400,
                    LITERAL_TYPE_NOT_FOUND
                );
            }
        }

        if (dto.nombre && dto.tipo_literal) {
            await this.#validationService.validateLiteralNameAndTypeUnique(dto.nombre, dto.tipo_literal);
        }

        const originalValues = literal.toJson();
        literal.update(dto);

        await this.#repository.update(literal);
        await this.#repository.saveHistory(literal, originalValues);

        literal.flushChanges();
    }
}
