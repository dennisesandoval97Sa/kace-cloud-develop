import { Banner } from '../../domain/Banner.js';
import { KnexRepository } from '../../../shared/index.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexBannersRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'banners', readerConfig);
    }

    /**
     * Saves the given `Banner` instance to the database.
     *
     * @param {Banner} banner - The `Banner` instance to save.
     * @returns {Promise<void>} A promise that resolves when the `Banner` instance is saved.
     *
     */
    async save(banner) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: banner.id.value,
                descripcion: banner.descripcion.value,
                propiedades: JSON.stringify(banner.propiedades.value),
                fecha_inicio: banner.fecha_inicio.value,
                fecha_fin: banner.fecha_fin.value,
                especificaciones: JSON.stringify(banner.especificaciones.value),
                status: banner.status.value,
                created_at: banner.created_at.value,
                updated_at: banner.updated_at.value,
                created_by: banner.created_by.value,
                updated_by: banner.updated_by.value,
            });
        } catch (error) {
            Helper.logInfo('Error saving banner', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds an `Banner` instance by its ID.
     *
     * @param {Object} id - The ID of the `Banner` instance to find.
     * @returns {Promise<Banner|null>} The found `Banner` instance or `null` if not found.
     */
    async find(id) {
        try {
            const result = await this.read.table('banners').first('*').whereNull('deleted_by').where({ id: id.value });

            if (!result) {
                return null;
            }

            return new Banner(result);
        } catch (error) {
            Helper.logInfo('Error finding banner', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Updates the given `Banner` instance in the database.
     *
     * @param {Banner} banner - The `Banner` instance to update.
     * @returns {Promise<void>} A promise that resolves when the `Banner` instance is updated.
     */
    async update(banner) {
        try {
            DbRequestContext.markWrite();
            if (banner.changedAttributes?.propiedades) {
                banner.changedAttributes.propiedades = JSON.stringify(banner.changedAttributes.propiedades);
            }

            if (banner.changedAttributes?.especificaciones) {
                banner.changedAttributes.especificaciones = JSON.stringify(banner.changedAttributes.especificaciones);
            }

            await this.table().update(banner.changedAttributes).whereNull('deleted_by').where({ id: banner.id.value });
        } catch (error) {
            Helper.logInfo('Error update banner', error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Deletes the given `Banner` instance from the database.
     *
     * @param {Banner} banner - The `Banner` instance to delete.
     * @returns {Promise<void>} A promise that resolves when the `Banner` instance is deleted.
     */
    async delete(banner) {
        try {
            DbRequestContext.markWrite();
            await this.table().update(banner.changedAttributes).where({ id: banner.id.value });
        } catch (error) {
            Helper.logInfo('Error delete banner', error);
            throw new QueryDBError('delete');
        }
    }

    /**
     * Searches for `Banner` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<Banner[]>} A promise that resolves to an array of `Banner` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table('banners').select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;

            return rows.map((row) => new Banner(row));
        } catch (error) {
            Helper.logInfo('Error search banner', error);
            throw new QueryDBError('search');
        }
    }

    async count(criteria) {
        try {
            const queryBuilder = this.read.table('banners').count('* as count');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;

            return rows[0].count;
        } catch (error) {
            Helper.logInfo('Error counting banners', error);
            throw new QueryDBError('count');
        }
    }
}
