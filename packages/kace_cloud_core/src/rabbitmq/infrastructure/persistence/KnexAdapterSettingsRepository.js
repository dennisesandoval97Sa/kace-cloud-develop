import { KnexRepository } from '../../../shared/index.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';
import { AdapterSettings } from '../../domain/AdapterSettings.js';

export class KnexAdapterSettingsRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'broker_adapters', readerConfig);
    }

    async create(adapter) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: adapter.id,
                name: adapter.name,
                host: adapter.host,
                port: adapter.port,
                queue: adapter.queue,
                vhost: adapter.vhost,
                exchange: adapter.exchange,
                vhost: adapter.vhost,
                username: adapter.username,
                password: adapter.password,
                password_encryption_migrated: adapter.password_encryption_migrated.value,
            });

            return adapter;
        } catch (error) {
            Helper.logError('Error saving adapter settings:', error);
            throw new QueryDBError('save');
        }
    }

    async findById(id) {
        try {
            const row = await this.table().where({ id }).first();
            return row ? new AdapterSettings(row) : null;
        } catch (error) {
            Helper.logError('Error finding adapter settings:', error);
            throw new QueryDBError('find');
        }
    }

    async findByName(name) {
        try {
            const row = await this.table().where({ name }).first();
            return row ? new AdapterSettings(row) : null;
        } catch (error) {
            Helper.logError('Error finding adapter by name:', error);
            throw new QueryDBError('find');
        }
    }

    async update(id, changes) {
        try {
            DbRequestContext.markWrite();
            await this.table().update(changes).where({ id });
            return { id, ...changes };
        } catch (error) {
            Helper.logError('Error updating adapter settings:', error);
            throw new QueryDBError('update');
        }
    }

    async delete(id) {
        try {
            DbRequestContext.markWrite();
            await this.table().update({ deleted_by: 'system', deleted_at: new Date().toISOString() }).where({ id });
            return { id };
        } catch (error) {
            Helper.logError('Error deleting adapter settings:', error);
            throw new QueryDBError('delete');
        }
    }

    async search(criteria) {
        try {
            const query = criteria.convertToKnex
                ? criteria.convertToKnex(this.read.table('broker_adapters').select('*').whereNull('deleted_by'))
                : this.read.table('broker_adapters').select('*').whereNull('deleted_by');
            const rows = await query;
            return rows.map((r) => new AdapterSettings(r));
        } catch (error) {
            Helper.logError('Error searching adapters:', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Counts adapters matching the criteria. Read-only list counter routed to the replica.
     * @param {Object} criteria
     * @returns {Promise<{count: number}>}
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('broker_adapters').count());
            query.whereNull('broker_adapters.deleted_at');

            const [count] = await query;
            return count;
        } catch (error) {
            Helper.logError('Error counting adapters:', error);
            throw new QueryDBError('count');
        }
    }
}
