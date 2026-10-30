import { v4 as uuidv4 } from 'uuid';
import { Literal } from '../../../src/literals';

export default class LiteralMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `Literal` entity.
     *
     * @param {Object} params - Optional parameters to override default values.
     * @returns {Object} The DTO containing the properties for a `Literal` entity.
     */
    static dto({ id, tipo_literal, nombre, created_by } = {}) {
        return {
            id: id ?? uuidv4(),
            tipo_literal: tipo_literal ?? null,
            nombre: nombre ?? 'literales',
            is_active: true,
            created_at: new Date().toISOString(),
            created_by: created_by ?? uuidv4(),
        };
    }

    /**
     * Creates a `Literal` instance and saves it to the repository.
     *
     * @param {Object} repository - The repository to save the `Literal` instance.
     * @param {Object} data - Optional data to override default values.
     * @returns {Literal} The created `Literal` instance.
     */
    static async createLiteral(repository, data = {}) {
        const literal = Literal.create(LiteralMother.dto(data));
        await repository.save(literal);
        return literal;
    }
}
