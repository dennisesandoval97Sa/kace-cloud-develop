import { v4 as uuidv4 } from 'uuid';
import { ClassificationTemplateRelations } from '../../../src/classification-template-relations';
import { ensureParentRows } from '../../support/ensureParentRow.js';

export default class ClassificationTemplateMother {
    /**
     * Postgres exige que existan las filas padre de estas claves foraneas, y
     * esta factoria inventaba los ids con `uuidv4()` sin respaldarlos.
     *
     * Se garantizan SIEMPRE, tambien cuando el llamador fijo el id:
     * `ensureParentRow` es idempotente, asi que respaldar una fila que ya existe
     * no cuesta nada, mientras que saltarsela deja el insert al borde de una
     * violacion. Las columnas salen de pg_constraint, no de mirar el dto.
     *
     * `plantillas.descripcion` es NOT NULL y ademas UNIQUE, asi que el respaldo
     * minimo no puede ser una fila con solo el id -daria 23502- ni compartir un
     * literal fijo entre plantillas -daria 23505, que `onConflict('id')` no
     * ignora-. Se deriva del propio id, que ya es unico.
     *
     * @param {import('knex').Knex} connection
     * @param {Object} dto
     * @returns {Promise<void>}
     */
    static async ensureRelations(connection, dto) {
        await ensureParentRows(connection, [
            { table: 'clasificaciones', id: dto.classification_id },
            { table: 'plantillas', id: dto.template_id, extra: { descripcion: `plantilla ${dto.template_id}` } },
        ]);
    }

    /**
     * Generates a Data Transfer Object (DTO) for the `ClassificationTemplateRelations` entity.
     *
     * @param {Object} [params={}] - Optional parameters to override default values.
     * @param {string} [params.template_id] - The ID of the template.
     * @param {string} [params.classification_id] - The ID of the classification.
     * @returns {Object} The DTO containing the properties for a `ClassificationTemplateRelations` entity.
     */
    static dto({ template_id, classification_id } = {}) {
        return {
            template_id: template_id ?? uuidv4(),
            classification_id: classification_id ?? uuidv4(),
        };
    }

    /**
     * Creates a `ClassificationTemplateRelations` instance and saves it to the repository.
     *
     * @param {KnexClassificationTemplateRelationsRepository} repository - The repository to save the `ClassificationTemplateRelations` instance.
     * @param {Object} [data={}] - Optional data to override default values.
     * @returns {Promise<ClassificationTemplateRelations>} The created `ClassificationTemplateRelations` instance.
     */
    static async create(repository, data = {}) {
        const dto = ClassificationTemplateMother.dto(data);
        await ClassificationTemplateMother.ensureRelations(repository.connection, dto);
        const classificationTemplateRelations = ClassificationTemplateRelations.create(dto);
        await repository.save(classificationTemplateRelations);
        return classificationTemplateRelations;
    }
}
