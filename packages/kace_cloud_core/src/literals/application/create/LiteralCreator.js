import { DomainLiteralFinder, Literal, ValidationService } from '../../index.js';
import { CustomError, InvalidArgumentError } from '../../../shared/index.js';
import { LITERAL_TYPE_NOT_FOUND } from '@kace/error-codes';

export class LiteralCreator {
    /** @type {KnexLiteralRepository} is initialized in the constructor */
    #repository;
    /** @type {ValidationService} is initialized in the constructor */
    #validationService;
    /** @type {DomainLiteralFinder} is initialized in the constructor */
    #literalFinder;

    /**
     * Creates an instance of `LiteralCreator`.
     *
     * @param {KnexLiteralRepository} repository - The repository used to save literals.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#validationService = new ValidationService(repository);
        this.#literalFinder = new DomainLiteralFinder(repository);
    }

    /**
     * Executes the process of creating a new literal.
     *
     * This method takes a data transfer object (DTO) containing the necessary properties to create
     * a new `Literal` object, and then saves it to the repository.
     *
     * @param {Object} dto - The data transfer object containing the properties for the `Literal` object.
     * @returns {Promise<void>} A promise that resolves when the `Literal` object is successfully created.
     */
    async execute(dto) {
        const literal = Literal.create(dto);

        const result = await this.#literalFinder.execute(literal.id.value);
        if (result) {
            throw new CustomError(`Literal with id ${literal.id.value} already exists`, 400);
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
            await this.#validationService.validateLiteralNameAndTypeUnique(dto.nombre, dto.tipo_literal);
        }

        if (!dto.tipo_literal) {
            await this.#validationService.validateLiteralNameUnique(dto.nombre);
            await this.#validationService.validateEntityExists(dto.nombre);
        }

        await this.#repository.save(literal);
        await this.#repository.saveHistory(literal);
    }
}
