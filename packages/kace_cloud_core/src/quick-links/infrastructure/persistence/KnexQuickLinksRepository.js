import { QuickLink } from '../../domain/QuickLink.js';
import { Helper, KnexRepository } from '../../../shared/index.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexQuickLinksRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'quick_links', readerConfig);
    }

    /**
     * Guarda un nuevo enlace rápido.
     *
     * @param {QuickLink} quickLink
     * @returns {Promise<void>}
     */
    async save(quickLink) {
        try {
            DbRequestContext.markWrite();

            await this.table().insert({
                id: quickLink.id.value,
                title: quickLink.title.value,
                url: quickLink.url.value,
                position: quickLink.position.value,
                created_at: quickLink.created_at?.value ?? null,
                created_by: quickLink.created_by?.value ?? null,
                updated_at: quickLink.updated_at?.value ?? null,
                updated_by: quickLink.updated_by?.value ?? null,
                deleted_at: quickLink.deleted_at?.value ?? null,
                deleted_by: quickLink.deleted_by?.value ?? null,
            });
        } catch (error) {
            Helper.logError('Error saving quick link:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Obtiene los enlaces activos ordenados por posición.
     *
     * @returns {Promise<QuickLink[]>}
     */
    async findAll() {
        try {
            const rows = await this.read
                .table('quick_links')
                .select('*')
                .whereNull('deleted_at')
                .orderBy('position', 'asc')
                .orderBy('id', 'asc');

            return rows.map((row) => new QuickLink(row));
        } catch (error) {
            Helper.logError('Error listing quick links:', error);
            throw new QueryDBError('findAll');
        }
    }

    /**
     * Busca un enlace activo por su identificador.
     *
     * @param {string} id
     * @returns {Promise<QuickLink|null>}
     */
    async find(id) {
        try {
            const row = await this.read.table('quick_links').where({ id }).whereNull('deleted_at').first('*');

            return row ? new QuickLink(row) : null;
        } catch (error) {
            Helper.logError('Error finding quick link:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Calcula la siguiente posición disponible.
     *
     * @returns {Promise<number>}
     */
    async nextPosition() {
        try {
            const result = await this.read
                .table('quick_links')
                .whereNull('deleted_at')
                .max('position as max_position')
                .first();

            return Number(result?.max_position ?? -1) + 1;
        } catch (error) {
            Helper.logError('Error calculating quick link position:', error);
            throw new QueryDBError('nextPosition');
        }
    }

    /**
     * Realiza el borrado lógico de un enlace rápido.
     *
     * @param {QuickLink} quickLink
     * @returns {Promise<void>}
     */
    async delete(quickLink) {
        try {
            DbRequestContext.markWrite();

            await this.table()
                .where({ id: quickLink.id.value })
                .whereNull('deleted_at')
                .update(quickLink.changedAttributes);
        } catch (error) {
            Helper.logError('Error deleting quick link:', error);
            throw new QueryDBError('delete');
        }
    }
}
