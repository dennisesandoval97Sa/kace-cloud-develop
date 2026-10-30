import { v4 as uuidv4 } from 'uuid';
import { Comment } from '../../../src/comments/index.js';
import Chance from 'chance';
import { ensureParentRow } from '../../support/ensureParentRow.js';

export default class CommentsMother {
    /**
     * `comentarios.caso_id` referencia a `cases` y esta factoria lleva anos
     * inventando ese id con `uuidv4()` sin respaldarlo con ninguna fila:
     * sqlite no comprobaba la clave foranea y postgres si.
     *
     * Se garantiza SIEMPRE, tambien cuando el llamador fijo el id:
     * `ensureParentRow` es idempotente, asi que respaldar una fila que ya
     * existe no cuesta nada. `created_by` no lleva clave foranea, asi que no
     * entra aqui: la lista sale de pg_constraint, no de mirar el dto.
     *
     * @param {import('knex').Knex} connection
     * @param {Object} dto
     * @returns {Promise<void>}
     */
    static async ensureRelations(connection, dto) {
        await ensureParentRow(connection, 'cases', dto.caso_id);
    }

    /**
     * Generates a Data Transfer Object (DTO) for the `Comment` entity.
     *
     * @returns {Object} The DTO containing the properties for an `Comment` entity.
     */
    static dto(caseId) {
        return {
            id: uuidv4(),
            descripcion: 'New Comment',
            calificacion: 5,
            caso_id: caseId ?? uuidv4(),
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };
    }
    /**
     * Generates a random Data Transfer Object (DTO) for the `Comment` entity.
     *
     * @returns {Object} The DTO containing random properties for an `Comment` entity.
     */
    static randomDto({ caso_id, created_by } = {}) {
        const chance = new Chance();
        return {
            id: uuidv4(),
            descripcion: chance.sentence({ words: 3 }),
            calificacion: chance.integer({ min: 1, max: 10 }),
            caso_id: caso_id ?? uuidv4(),
            created_at: new Date().toISOString(),
            created_by: created_by ?? uuidv4(),
        };
    }
    /**
     * Creates an `Comment` instance with random properties and saves it to the repository.
     *
     * @param {KnexCommentRepository} repository - The repository to save the `Comment` instance.
     * @returns {Comment} The created `Comment` instance.
     */
    static async createRandomComment(repository, overrides = {}) {
        const dto = CommentsMother.randomDto(overrides);
        await CommentsMother.ensureRelations(repository.connection, dto);
        const comment = Comment.create(dto);
        await repository.save(comment);
        return comment;
    }
    /**
     * Creates an `Comment` instance and saves it to the repository.
     *
     * @param {KnexCommentsRepository} repository - The repository to save the `Comment` instance.
     * @returns {Comment} The created `Comment` instance.
     */
    static async createComment(repository, caseId) {
        const dto = CommentsMother.dto(caseId);
        await CommentsMother.ensureRelations(repository.connection, dto);
        const comment = Comment.create(dto);
        await repository.save(comment);
        return comment;
    }
    static getDateWithOnlyDate() {
        const today = new Date();
        return today.toISOString().split('T')[0];
    }
}
