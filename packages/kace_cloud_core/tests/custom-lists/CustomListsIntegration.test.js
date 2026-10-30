import {
    CustomListsCreator,
    CustomListsSearcher,
    CustomListsUpdater,
    CustomListsDeleter,
    KnexCustomListsRepository,
} from '../../src/custom-lists';
import CustomListMother from './domain/CustomListMother.js';
import { knexConfig } from '../knexfile.js';
import { v4 as uuid } from 'uuid';
import { InvalidArgumentError } from '../../src/shared/errors/InvalidArgumentError.js';

const repository = new KnexCustomListsRepository(knexConfig);
const creator = new CustomListsCreator(repository);
const searcher = new CustomListsSearcher(repository);
const updater = new CustomListsUpdater(repository);
const deleter = new CustomListsDeleter(repository);

describe('Custom Lists Searcher Integration', () => {
    it('should search by aux_entity and order by name desc with limit/offset', async () => {
        const auxEntity = 'aux_countries';

        const dto1 = CustomListMother.dto({ name: 'AAA', aux_entity: auxEntity, groups: [uuid()] });
        const dto2 = CustomListMother.dto({
            name: 'CCC',
            aux_entity: auxEntity,
            aux_items: [{ literal: uuid(), order: 2 }],
        });
        const dto3 = CustomListMother.dto({ name: 'BBB', aux_entity: auxEntity });

        // Los grupos son uuids inventados aqui: sin respaldarlos, el insert de
        // `custom_lists_groups_relations` cae por clave foranea.
        await CustomListMother.ensureRelations(repository.connection, dto1);

        await creator.execute(dto1);
        await creator.execute(dto2);
        await creator.execute(dto3);

        const res1 = await searcher.execute({
            filter: [{ field: 'aux_entity', operator: 'eq', value: auxEntity, type: 'AND' }],
            relationship: null,
            order: { field: 'name', direction: 'desc' },
            limit: 2,
            offset: 0,
        });

        const json1 = res1.toJson();
        expect(json1.metadata.count).toBe(2);
        expect(json1.data.items.map((i) => i.name)).toEqual(['CCC', 'BBB']);

        const res2 = await searcher.execute({
            filter: [{ field: 'aux_entity', operator: 'eq', value: auxEntity, type: 'AND' }],
            relationship: null,
            order: { field: 'name', direction: 'desc' },
            limit: 2,
            offset: 2,
        });

        const json2 = res2.toJson();
        expect(json2.data.items.map((i) => i.name)).toEqual(['AAA']);

        const first = json1.data.items[0];
        expect(Array.isArray(first.aux_items)).toBe(true);
        expect(Array.isArray(first.groups)).toBe(true);
    });
});

describe('Custom Lists Updater Integration', () => {
    it('updates scalar fields and REPLACES collections (aux_items & groups) atomically', async () => {
        const dto = CustomListMother.dto({
            name: 'Before',
            aux_entity: 'aux_countries',
            aux_items: [
                { literal: uuid(), order: 2 },
                { literal: uuid(), order: 1 },
            ],
            groups: [uuid()],
        });
        await CustomListMother.ensureRelations(repository.connection, dto);
        await creator.execute(dto);

        const newAux = [
            { literal: uuid(), order: 3 },
            { literal: uuid(), order: 1 },
        ];
        const newGroups = [uuid(), uuid()];
        await CustomListMother.ensureRelations(repository.connection, { groups: newGroups });
        await updater.execute(dto.id, {
            name: 'After',
            is_active: false,
            aux_entity: 'aux_regions',
            aux_items: newAux,
            groups: newGroups,
            updated_by: uuid(),
        });

        const row = await repository.connection('custom_lists').where({ id: dto.id }).first();
        expect(row.name).toBe('After');
        expect(row.aux_entity).toBe('aux_regions');
        expect(row.is_active === 0 || row.is_active === false).toBe(true);
        expect(row.updated_at).toBeTruthy();
        expect(row.updated_by).toBeTruthy();

        const rels = await repository
            .connection('custom_lists_auxiliar_relations')
            .where({ custom_list_id: dto.id })
            .orderBy('order', 'asc');
        const groups = await repository
            .connection('custom_lists_groups_relations')
            .where({ custom_list_id: dto.id })
            .orderBy('group_id', 'asc');

        expect(rels.map((r) => ({ literal: r.literal, order: r.order }))).toEqual(
            newAux.slice().sort((a, b) => a.order - b.order)
        );
        expect(groups.map((g) => g.group_id).sort()).toEqual(newGroups.slice().sort());
    });

    it('keeps collections UNTOUCHED if they are not provided (partial scalar update)', async () => {
        const g1 = uuid(),
            g2 = uuid();
        const ai1 = { literal: uuid(), order: 1 },
            ai2 = { literal: uuid(), order: 2 };
        const dto = CustomListMother.dto({
            name: 'Base',
            aux_entity: 'aux_countries',
            groups: [g1, g2],
            aux_items: [ai1, ai2],
        });
        await CustomListMother.ensureRelations(repository.connection, dto);
        await creator.execute(dto);

        await updater.execute(dto.id, {
            name: 'Only name',
            updated_by: uuid(),
        });

        const row = await repository.connection('custom_lists').where({ id: dto.id }).first();
        expect(row.name).toBe('Only name');

        const rels = await repository
            .connection('custom_lists_auxiliar_relations')
            .where({ custom_list_id: dto.id })
            .orderBy('order', 'asc');
        const groups = await repository.connection('custom_lists_groups_relations').where({ custom_list_id: dto.id });

        expect(rels.map((r) => ({ literal: r.literal, order: r.order }))).toEqual([
            { literal: ai1.literal, order: 1 },
            { literal: ai2.literal, order: 2 },
        ]);
        expect(groups.map((g) => g.group_id).sort()).toEqual([g1, g2].sort());
    });

    it('allows EMPTY arrays to CLEAR relations (aux_items = [], groups = [])', async () => {
        const dto = CustomListMother.dto({
            aux_items: [{ literal: uuid(), order: 1 }],
            groups: [uuid()],
        });
        await CustomListMother.ensureRelations(repository.connection, dto);
        await creator.execute(dto);

        await updater.execute(dto.id, {
            name: 'Clear relations',
            aux_items: [],
            groups: [],
            updated_by: uuid(),
        });

        const row = await repository.connection('custom_lists').where({ id: dto.id }).first();
        expect(row.name).toBe('Clear relations');

        const rels = await repository.connection('custom_lists_auxiliar_relations').where({ custom_list_id: dto.id });
        const groups = await repository.connection('custom_lists_groups_relations').where({ custom_list_id: dto.id });

        expect(rels.length).toBe(0);
        expect(groups.length).toBe(0);
    });

    it('throws on uniqueness conflict (name + aux_entity)', async () => {
        const a = CustomListMother.dto({ name: 'X', aux_entity: 'aux_countries' });
        const b = CustomListMother.dto({ name: 'Y', aux_entity: 'aux_regions' });
        await creator.execute(a);
        await creator.execute(b);

        await expect(
            updater.execute(b.id, {
                name: 'X',
                aux_entity: 'aux_countries',
                updated_by: uuid(),
            })
        ).rejects.toThrow(/already exists/i);
    });

    it('rolls back everything if relation update fails', async () => {
        const dto = CustomListMother.dto({
            aux_items: [{ literal: uuid(), order: 1 }],
            groups: [uuid()],
        });
        await CustomListMother.ensureRelations(repository.connection, dto);
        await creator.execute(dto);

        await expect(
            updater.execute(dto.id, {
                is_active: 'not-boolean',
                updated_by: uuid(),
            })
        ).rejects.toBeTruthy();

        const rels = await repository.connection('custom_lists_auxiliar_relations').where({ custom_list_id: dto.id });
        const groups = await repository.connection('custom_lists_groups_relations').where({ custom_list_id: dto.id });

        expect(rels.length).toBe(1);
        expect(groups.length).toBe(1);
    });
});

describe('Custom Lists Deleter Integration', () => {
    it('soft-deletes a custom list and keeps relations (soft model)', async () => {
        const dto = CustomListMother.dto({
            aux_items: [{ literal: uuid(), order: 1 }],
            groups: [uuid()],
        });
        await CustomListMother.ensureRelations(repository.connection, dto);
        await creator.execute(dto);

        const del = { deleted_at: new Date().toISOString(), deleted_by: uuid() };
        await deleter.execute(dto.id, del);

        const row = await repository.connection('custom_lists').where('id', dto.id).first();
        expect(row.deleted_at).toBeTruthy();
        expect(row.deleted_by).toBe(del.deleted_by);

        const rels = await repository.connection('custom_lists_auxiliar_relations').where('custom_list_id', dto.id);
        const grps = await repository.connection('custom_lists_groups_relations').where('custom_list_id', dto.id);
        expect(rels.length).toBe(1);
        expect(grps.length).toBe(1);
    });

    it('throws if id does not exist', async () => {
        await expect(
            deleter.execute(uuid(), { deleted_at: new Date().toISOString(), deleted_by: uuid() })
        ).rejects.toThrow(/does not exist/i);
    });
});
