import { Template } from '../../domain/Template.js';
import { KnexRepository } from '../../../shared/infrastructure/persistence/KnexRepository.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexTemplatesRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'plantillas', readerConfig);
    }

    /**
     * Saves the given `Template` instance to the database.
     *
     * @param {Template} template - The `Template` instance to save.
     * @returns {Promise<void>} A promise that resolves when the `Template` instance is saved.
     *
     */
    async save(template) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: template.id.value,
                descripcion: template.descripcion.value,
                ruta: template.ruta.value,
                tipo: template.tipo.value,
                destinatario: template.destinatario.value,
                copia: template.copia.value,
                copia_oculta: template.copia_oculta.value,
                asunto: template.asunto.value,
                cuerpo: template.cuerpo.value,
                incluye_adjuntos: template.incluye_adjuntos.value,
                enviar_adjuntos_del_caso: template.enviar_adjuntos_del_caso.value,
                status: template.status.value,
                created_at: template.created_at.value,
                updated_at: template.updated_at.value,
                created_by: template.created_by.value,
                updated_by: template.updated_by.value,
            });
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds an `Template` instance by its ID.
     *
     * @param {Object} id - The ID of the `Template` instance to find.
     * @returns {Promise<Template|null>} The found `Template` instance or `null` if not found.
     */
    async find(id) {
        try {
            const result = await this.read
                .table('plantillas')
                .first('*')
                .whereNull('deleted_by')
                .where({ id: id.value });
            if (!result) {
                return null;
            }
            return new Template(result);
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Updates the given `Template` instance in the database.
     *
     * @param {Template} template - The `Template` instance to update.
     * @returns {Promise<void>} A promise that resolves when the `Template` instance is updated.
     */
    async update(template) {
        try {
            DbRequestContext.markWrite();
            await this.table()
                .update(template.changedAttributes)
                .whereNull('deleted_by')
                .where({ id: template.id.value });
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Deletes the given `Template` instance from the database.
     *
     * @param {Template} template - The `Template` instance to delete.
     * @returns {Promise<void>} A promise that resolves when the `Template` instance is deleted.
     */
    async delete(template) {
        try {
            DbRequestContext.markWrite();
            await this.table().update(template.changedAttributes).where({ id: template.id.value });
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('delete');
        }
    }

    /**
     * Searches for `Template` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<Template[]>} A promise that resolves to an array of `Template` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table('plantillas').select('*');
            criteria.convertToKnex(queryBuilder);
            queryBuilder.whereNull('deleted_by');
            const rows = await queryBuilder;
            return rows.map((row) => new Template(row));
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('delete');
        }
    }

    async count(criteria) {
        try {
            const queryBuilder = this.read.table('plantillas').count('* as count');
            criteria.convertToKnex(queryBuilder);
            queryBuilder.whereNull('deleted_by');
            const rows = await queryBuilder;
            return rows[0].count;
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('count');
        }
    }
}
