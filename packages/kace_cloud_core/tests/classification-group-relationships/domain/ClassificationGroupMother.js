import { v4 as uuidv4 } from 'uuid';
import { ClassificationGroupRelationship } from '../../../src/classification-group-relationships';
import { ensureParentRows } from '../../support/ensureParentRow.js';

export default class ClassificationGroupMother {
    /**
     * Postgres exige que existan las filas padre de estas claves foraneas, y
     * esta factoria inventaba los ids con `uuidv4()` sin respaldarlos.
     *
     * Se garantizan SIEMPRE, tambien cuando el llamador fijo el id:
     * `ensureParentRow` es idempotente, asi que respaldar una fila que ya existe
     * no cuesta nada, mientras que saltarsela deja el insert al borde de una
     * violacion. Las columnas salen de pg_constraint, no de mirar el dto.
     *
     * @param {import('knex').Knex} connection
     * @param {Object} dto
     * @returns {Promise<void>}
     */
    static async ensureRelations(connection, dto) {
        await ensureParentRows(connection, [
            { table: 'clasificaciones', id: dto.classification_id },
            { table: 'grupos', id: dto.group_id },
            { table: 'one-script', id: dto.form },
        ]);
    }

    /**
     * Generates a Data Transfer Object (DTO) for the `ClassificationGroupRelationship` entity.
     *
     * @param {Object} [params={}] - Optional parameters to override default values.
     * @param {string} [params.group_id] - The ID of the group.
     * @param {string} [params.classification_id] - The ID of the classification.
     * @param {string} [params.form] - The form value.
     * @returns {Object} The DTO containing the properties for a `ClassificationGroupRelationship` entity.
     */
    static dto({ group_id, classification_id, form } = {}) {
        return {
            group_id: group_id ?? uuidv4(),
            classification_id: classification_id ?? uuidv4(),
            form: form ?? 'default_form_value',
        };
    }

    /**
     * Creates a `ClassificationGroupRelationship` instance and saves it to the repository.
     *
     * @param {KnexClassificationGroupRelationshipRepository} repository - The repository to save the `ClassificationGroupRelationship` instance.
     * @param {Object} [data={}] - Optional data to override default values.
     * @returns {Promise<ClassificationGroupRelationship>} The created `ClassificationGroupRelationship` instance.
     */
    static async create(repository, data = {}) {
        const dto = ClassificationGroupMother.dto(data);
        await ClassificationGroupMother.ensureRelations(repository.connection, dto);
        const classificationGroupRelationship = ClassificationGroupRelationship.create(dto);
        await repository.save(classificationGroupRelationship);
        return classificationGroupRelationship;
    }
}
