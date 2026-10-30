import { KnexRepository } from '../../../shared/index.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';
import { Mapper } from '../../domain/Mapper.js';
import { ValueObjectUuid } from '../../../shared/domain/value-object/ValueObjectUuid.js';

export class KnexMapperRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'broker_message_mappers', readerConfig);
    }

    async create(dto) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: dto.id,
                name: dto.name,
                rest_flow_id: dto.rest_flow_id,
            });

            if (Array.isArray(dto.rules) && dto.rules.length > 0) {
                const rulesRows = dto.rules.map((r) => ({
                    id: r.id,
                    mapper_id: dto.id,
                    target_entity: r.target_entity,
                    target_field: r.target_field,
                    source_field: r.source_field,
                    parse_to: r.parse_to || null,
                }));
                await this.table('broker_message_mapper_rules').insert(rulesRows);
            }

            return dto;
        } catch (error) {
            Helper.logError('Error creating mapper:', error);
            throw new QueryDBError('create');
        }
    }

    async findById(id) {
        try {
            const row = await this.table().where({ id: id }).first();
            if (!row) return null;
            const rules = await this.table('broker_message_mapper_rules').where({ mapper_id: id }).select('*');
            return new Mapper({ ...row, rules });
        } catch (error) {
            Helper.logError('Error finding mapper:', error);
            throw new QueryDBError('findById');
        }
    }

    async update(id, changes) {
        try {
            DbRequestContext.markWrite();
            await this.connection.transaction(async (trx) => {
                const { rules, ...mapperChanges } = changes || {};
                if (Object.keys(mapperChanges).length > 0) {
                    await this.trxTable(trx).update(mapperChanges).where({ id });
                }

                if (Array.isArray(rules)) {
                    const existingRules = await this.trxTable(trx, 'broker_message_mapper_rules')
                        .where({ mapper_id: id })
                        .select('id');
                    const existingIds = existingRules.map((r) => r.id);
                    const incomingIds = rules.filter((r) => r.id).map((r) => r.id);
                    const toDelete = existingIds.filter((e) => !incomingIds.includes(e));

                    if (toDelete.length > 0) {
                        await this.trxTable(trx, 'broker_message_mapper_rules').whereIn('id', toDelete).del();
                    }

                    // Insert rules that don't have an id OR have an id that doesn't exist in DB
                    const toInsert = rules
                        .filter((r) => !r.id || !existingIds.includes(r.id))
                        .map((r) => ({
                            id: r.id || ValueObjectUuid.random(),
                            mapper_id: id,
                            target_entity: r.target_entity,
                            target_field: r.target_field,
                            source_field: r.source_field,
                            parse_to: r.parse_to || null,
                        }));
                    if (toInsert.length > 0) {
                        await this.trxTable(trx, 'broker_message_mapper_rules').insert(toInsert);
                    }

                    const toUpdate = rules.filter((r) => r.id && existingIds.includes(r.id));
                    for (const ru of toUpdate) {
                        const upd = {
                            target_entity: ru.target_entity,
                            target_field: ru.target_field,
                            source_field: ru.source_field,
                            parse_to: ru.parse_to || null,
                        };
                        await this.trxTable(trx, 'broker_message_mapper_rules').update(upd).where({ id: ru.id });
                    }
                }
            });

            return { id, ...changes };
        } catch (error) {
            Helper.logError('Error updating mapper:', error);
            throw new QueryDBError('update');
        }
    }

    async delete(id) {
        try {
            DbRequestContext.markWrite();
            await this.table().update({ deleted_by: 'system', deleted_at: new Date().toISOString() }).where({ id });
            return { id };
        } catch (error) {
            Helper.logError('Error deleting mapper:', error);
            throw new QueryDBError('delete');
        }
    }

    async search(criteria) {
        try {
            const baseQuery = this.read.table('broker_message_mappers').select('*').whereNull('deleted_by');

            const query = criteria.convertToKnex ? criteria.convertToKnex(baseQuery) : baseQuery;
            const rows = await query;
            const results = [];
            for (const r of rows) {
                const rules = await this.read
                    .table('broker_message_mapper_rules')
                    .where({ mapper_id: r.id })
                    .select('*');
                results.push(new Mapper({ ...r, rules }));
            }
            return results;
        } catch (error) {
            Helper.logError('Error searching mappers:', error);
            throw new QueryDBError('search');
        }
    }

    async count(criteria) {
        try {
            const baseQuery = this.read.table('broker_message_mappers').whereNull('deleted_by');

            const query = criteria.convertToKnex ? criteria.convertToKnex(baseQuery) : baseQuery;
            const [{ count }] = await query.clone().count({ count: '*' });
            const num = typeof count === 'string' ? parseInt(count, 10) : count;
            return num ?? 0;
        } catch (error) {
            Helper.logError('Error counting mappers:', error);
            throw new QueryDBError('count');
        }
    }
}
