import { InvalidArgumentError } from '../../shared/errors/InvalidArgumentError';
import { LITERAL_ENTITY_NOT_FOUND, LITERAL_NAME_ALREADY_EXISTS } from '@kace/error-codes';
import { LiteralSearcher } from '../index';

export class ValidationService {
    /** @type {KnexLiteralRepository} is initialized in the constructor */
    #repository;
    /** @type {LiteralSearcher} is initialized in the constructor */
    #literalSearcher;

    /**
     * Constructs a new instance of ValidationService.
     * @param {KnexLiteralRepository} repository - The repository used to find literals.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#literalSearcher = new LiteralSearcher(repository);
    }

    /**
     * @param {string} tableName
     * @returns {Promise<boolean>}
     */
    async validateEntityExists(tableName) {
        const isEntity = await this.#repository.entityExists(tableName);
        if (!isEntity) {
            throw new InvalidArgumentError(`The entity ${tableName} does not exist`, 400, LITERAL_ENTITY_NOT_FOUND);
        }
    }

    /**
     * Validates that a literal with the same name does not already exist.
     *
     * @param {string} literalName - The name of the literal to check.
     * @returns {Promise<void>}
     * @throws {InvalidArgumentError} If a literal with the same name already exists.
     */
    async validateLiteralNameUnique(literalName) {
        const dtoCriteria = {
            filter: [
                {
                    field: 'nombre',
                    operator: 'eq',
                    value: literalName,
                    type: 'AND',
                },
                {
                    field: 'tipo_literal',
                    operator: 'null',
                    value: 'tipo_literal',
                    type: 'AND',
                },
            ],
            limit: 1,
            offset: 0,
            order: null,
        };

        const existingLiteral = await this.#literalSearcher.execute(dtoCriteria);
        if (existingLiteral && existingLiteral.toJson().data.items.length > 0) {
            throw new InvalidArgumentError(
                `A Literal with the name "${literalName}" already exists.`,
                400,
                LITERAL_NAME_ALREADY_EXISTS
            );
        }
    }

    /**
     * Validates that a literal with the same name and type does not already exist.
     *
     * @param {string} literalName - The name of the literal to check.
     * @param {string} tipoLiteral - The type of the literal to check.
     * @returns {Promise<void>}
     * @throws {InvalidArgumentError} If a literal with the same name and type already exists.
     */
    async validateLiteralNameAndTypeUnique(literalName, tipoLiteral) {
        const dtoCriteria = {
            filter: [
                {
                    field: 'nombre',
                    operator: 'eq',
                    value: literalName,
                    type: 'AND',
                },
                {
                    field: 'tipo_literal',
                    operator: 'eq',
                    value: tipoLiteral,
                    type: 'AND',
                },
            ],
            limit: 1,
            offset: 0,
            order: null,
        };

        const existingLiteral = await this.#literalSearcher.execute(dtoCriteria);
        if (existingLiteral && existingLiteral.toJson().data.items.length > 0) {
            throw new InvalidArgumentError(
                `A Literal with the name "${literalName}" for the selected literal type already exists`,
                400,
                LITERAL_NAME_ALREADY_EXISTS
            );
        }
    }
}
