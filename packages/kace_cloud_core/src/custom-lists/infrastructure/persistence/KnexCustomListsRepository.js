import { KnexRepository, Helper, QueryDBError } from '../../../shared/index';
import { v4 as uuid } from 'uuid';
import { CustomLists } from '../../index.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexCustomListsRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'custom_lists', readerConfig);
        this.relationsTable = 'custom_lists_auxiliar_relations';
        this.groupsTable = 'custom_lists_groups_relations';
    }

    async save(dto) {
        DbRequestContext.markWrite();
        const trxProvider = this.connection.transactionProvider();
        const trx = await trxProvider();

        try {
            await this.trxTable(trx, this.tableName).insert({
                id: dto.id,
                name: dto.name,
                is_active: dto.is_active ?? true,
                aux_entity: dto.aux_entity,
                created_at: dto.created_at,
                created_by: dto.created_by,
                updated_at: dto.updated_at ?? null,
                updated_by: dto.updated_by ?? null,
                deleted_at: null,
                deleted_by: null,
            });

            if (Array.isArray(dto.aux_items) && dto.aux_items.length > 0) {
                const rows = dto.aux_items.map((it) => ({
                    id: uuid(),
                    custom_list_id: dto.id,
                    literal: it.literal,
                    order: it.order,
                }));
                await this.trxTable(trx, this.relationsTable).insert(rows);
            }

            if (Array.isArray(dto.groups) && dto.groups.length > 0) {
                const rows = dto.groups.map((gid) => ({
                    custom_list_id: dto.id,
                    group_id: gid,
                }));
                await this.trxTable(trx, this.groupsTable).insert(rows);
            }

            await trx.commit();
        } catch (error) {
            await trx.rollback();
            Helper.logError('Error saving custom list + relations:', error);
            throw new QueryDBError('save');
        }
    }

    async find(id) {
        try {
            const row = await this.read.table('custom_lists').select('*').where({ id: id.value }).first();

            if (!row) return null;

            const aux = await this.read
                .table(this.relationsTable)
                .select('literal', 'order')
                .where({ custom_list_id: id.value })
                .orderBy('order', 'asc');

            const groups = await this.read
                .table(this.groupsTable)
                .select('group_id')
                .where({ custom_list_id: id.value });

            return CustomLists.create({
                ...row,
                aux_items: aux,
                groups: groups.map((g) => g.group_id),
            });
        } catch (e) {
            Helper.logError('Error finding custom list (aggregate):', e);
            throw new QueryDBError('find');
        }
    }

    async findById(id) {
        try {
            const row = await this.read.table('custom_lists').where({ id }).first();
            return row || null;
        } catch (error) {
            Helper.logError('Error finding custom list:', error);
            throw new QueryDBError('find');
        }
    }

    async existsByNameAndEntity(name, aux_entity) {
        try {
            const row = await this.read.table('custom_lists').where({ name, aux_entity }).first();
            return !!row;
        } catch (error) {
            Helper.logError('Error checking unique name+entity:', error);
            throw new QueryDBError('find');
        }
    }

    async search(criteria) {
        try {
            const t = this.tableName;

            const q = this.read.table(t).select(`${t}.*`);

            criteria?.convertToKnex(q);

            q.whereNull(`${t}.deleted_at`);

            const baseRows = await q;
            if (baseRows.length === 0) return [];

            const hasId = Object.prototype.hasOwnProperty.call(baseRows[0], 'id');
            if (!hasId) {
                return baseRows.map((row) =>
                    CustomLists.create({
                        ...row,
                        aux_items: [],
                        groups: [],
                    })
                );
            }

            const ids = baseRows.map((r) => r.id);

            const relRows = await this.read
                .table(this.relationsTable)
                .select('custom_list_id', 'literal', 'order')
                .whereIn('custom_list_id', ids)
                .orderBy([
                    { column: 'custom_list_id', order: 'asc' },
                    { column: 'order', order: 'asc' },
                ]);

            const grpRows = await this.read
                .table(this.groupsTable)
                .select('custom_list_id', 'group_id')
                .whereIn('custom_list_id', ids);

            const auxByList = new Map();
            for (const r of relRows) {
                const arr = auxByList.get(r.custom_list_id) ?? [];
                arr.push({ literal: r.literal, order: r.order });
                auxByList.set(r.custom_list_id, arr);
            }

            const groupsByList = new Map();
            for (const g of grpRows) {
                const arr = groupsByList.get(g.custom_list_id) ?? [];
                arr.push(g.group_id);
                groupsByList.set(g.custom_list_id, arr);
            }

            return baseRows.map((row) =>
                CustomLists.create({
                    ...row,
                    aux_items: auxByList.get(row.id) ?? [],
                    groups: groupsByList.get(row.id) ?? [],
                })
            );
        } catch (error) {
            Helper.logError('Error searching custom lists:', error);
            throw new QueryDBError('search');
        }
    }

    async update(aggregate) {
        const t = this.tableName;
        const relT = this.relationsTable;
        const grpT = this.groupsTable;
        const id = aggregate.id.value;

        const changes = aggregate.getchangedAttributes?.() ?? {};

        const scalarKeys = ['name', 'is_active', 'aux_entity', 'updated_at', 'updated_by', 'deleted_at', 'deleted_by'];
        const scalar = {};
        for (const k of scalarKeys) if (k in changes) scalar[k] = changes[k];

        const hasAuxItems = Object.prototype.hasOwnProperty.call(changes, 'aux_items');
        const hasGroups = Object.prototype.hasOwnProperty.call(changes, 'groups');

        DbRequestContext.markWrite();
        await this.connection.transaction(async (trx) => {
            if (Object.keys(scalar).length > 0) {
                await this.trxTable(trx, t).update(scalar).where({ id }).whereNull('deleted_at');
            }

            if (hasAuxItems) {
                await this.trxTable(trx, relT).where({ custom_list_id: id }).del();
                const items = (changes.aux_items ?? []).map((it) => ({
                    id: uuid(),
                    custom_list_id: id,
                    literal: it.literal,
                    order: it.order ?? 1,
                }));
                if (items.length) await this.trxTable(trx, relT).insert(items);
            }

            if (hasGroups) {
                await this.trxTable(trx, grpT).where({ custom_list_id: id }).del();
                const rows = (changes.groups ?? []).map((gid) => ({
                    custom_list_id: id,
                    group_id: gid,
                }));
                if (rows.length) await this.trxTable(trx, grpT).insert(rows);
            }
        });
    }

    async findByIdAndGroup(customListId, groupId) {
        try {
            const t = this.tableName;
            const grpT = this.groupsTable;

            const row = await this.read
                .table(t)
                .select(`${t}.*`)
                .innerJoin(this.qualifiedName(grpT), `${t}.id`, `${grpT}.custom_list_id`)
                .where(`${t}.id`, customListId)
                .whereNull(`${t}.deleted_at`)
                .andWhere(`${grpT}.group_id`, groupId)
                .first();

            if (!row) {
                return null;
            }

            const auxItems = await this.read
                .table(this.relationsTable)
                .select('literal', 'order')
                .where({ custom_list_id: customListId })
                .orderBy('order', 'asc');

            const groups = await this.read
                .table(this.groupsTable)
                .select('group_id')
                .where({ custom_list_id: customListId });

            return CustomLists.create({
                ...row,
                aux_items: auxItems,
                groups: groups.map((g) => g.group_id),
            });
        } catch (error) {
            Helper.logError('Error finding custom list by id and group:', error);
            throw new QueryDBError('findByIdAndGroup');
        }
    }
}
