import { v4 as uuidV4 } from 'uuid';
import { CustomLists } from '../../src/custom-lists/domain/CustomLists.js';
import { ValueObjectUuid, ValueObjectBoolean, ValueObjectTimestamp } from '../../src/shared/index.js';
import { ValueObjectCustomListsName } from '../../src/custom-lists/domain/ValueObjectCustomListsName.js';
import { ValueObjectAuxEntity } from '../../src/custom-lists/domain/ValueObjectAuxEntity.js';
import { CustomListResponse } from '../../src/custom-lists/index.js';
import { CustomListCollectionResponse } from '../../src/custom-lists/index.js';

class CustomListMother {
  static dto(overrides = {}) {
    const id = uuidV4();
    return {
      id,
      name: `List-${id.slice(0, 8)}`,
      is_active: true,
      aux_entity: 'aux_countries',
      aux_items: [
        { aux_id: uuidV4(), order: 2 },
        { aux_id: uuidV4(), order: 1 },
      ],
      groups: [uuidV4(), uuidV4()],
      created_at: new Date().toISOString(),
      created_by: uuidV4(),
      updated_at: null,
      updated_by: null,
      deleted_at: null,
      deleted_by: null,
      ...overrides,
    };
  }
}

describe('CustomList Entity', () => {
  const dto = CustomListMother.dto();

  it('should create a CustomList with valid data', () => {
    const a = CustomLists.create(dto);

    expect(a.id).toBeInstanceOf(ValueObjectUuid);
    expect(a.name).toBeInstanceOf(ValueObjectCustomListsName);
    expect(a.is_active).toBeInstanceOf(ValueObjectBoolean);
    expect(a.aux_entity).toBeInstanceOf(ValueObjectAuxEntity);

    expect(a.created_at).toBeDefined();
    expect(a.created_by).toBeDefined();

    expect(Array.isArray(a.aux_items)).toBe(true);
    expect(Array.isArray(a.groups)).toBe(true);
    expect(a.aux_items.length).toBe(2);
    expect(a.groups.length).toBe(2);
  });

  it('should normalize aux_items order (fallback by index) and keep groups unique', () => {
    const auxId = uuidV4();
    const dup = uuidV4();
    const list = CustomLists.create(CustomListMother.dto({
      aux_items: [{ aux_id: auxId }, { aux_id: uuidV4(), order: 5 }],
      groups: [dup, dup, uuidV4()],
    }));

    const orders = list.aux_items.map(i => i.order);
    expect(orders[0]).toBeGreaterThanOrEqual(1);
    expect(orders[1]).toBe(5);

    const uniqueGroups = new Set(list.groups.map(g => g.value ?? g));
    expect(uniqueGroups.size).toBe(list.groups.length);
  });

  it('should update scalar fields and mark changedAttributes', () => {
    const a = CustomLists.create(dto);

    const updateDto = {
      name: 'Updated Name',
      is_active: false,
      aux_entity: 'aux_regions',
      updated_at: new Date().toISOString(),
      updated_by: uuidV4(),
    };

    a.update(updateDto);
    expect(a.name.value).toBe('Updated Name');
    expect(a.is_active.value).toBe(false);
    expect(a.aux_entity.value).toBe('aux_regions');

    expect(a.changedAttributes).toEqual(updateDto);
  });

  it('should replace collections when provided (aux_items & groups)', () => {
    const a = CustomLists.create(dto);
    const newAux = [{ aux_id: uuidV4(), order: 3 }, { aux_id: uuidV4(), order: 1 }];
    const newGroups = [uuidV4()];

    a.update({ aux_items: newAux, groups: newGroups });

    expect(a.aux_items.map(x => x.order).sort((x,y)=>x-y)).toEqual([1,3]);
    expect(a.groups.map(g => g.value ?? g)).toEqual(newGroups);
    expect(a.changedAttributes.aux_items).toBeDefined();
    expect(a.changedAttributes.groups).toBeDefined();
  });

  it('does not change attributes when values are the same', () => {
    const a = CustomLists.create(dto);
    const unchanged = {
      name: dto.name,
      is_active: dto.is_active,
      aux_entity: dto.aux_entity,
    };
    a.update(unchanged);
    expect(a.changedAttributes).toEqual({});
  });

  it('should throw on invalid UUID id', () => {
    const invalid = { ...dto, id: 'not-uuid' };
    expect(() => CustomLists.create(invalid)).toThrow(/Invalid value .* for object uuid/i);
  });

  it('flushes changes', () => {
    const a = CustomLists.create(dto);
    a.update({ name: 'X', updated_at: new Date().toISOString(), updated_by: uuidV4() });
    a.flushChanges();
    expect(a.changedAttributes).toEqual({});
  });

  it('marks CustomList as deleted (soft-delete)', () => {
    const a = CustomLists.create(dto);
    const del = { deleted_at: new Date().toISOString(), deleted_by: uuidV4() };
    a.delete(del);

    expect(a.deleted_at.value ?? a.deleted_at).toBe(del.deleted_at);
    expect(a.deleted_by.value ?? a.deleted_by).toBe(del.deleted_by);
  });

  it('should require delete fields (deleted_at/deleted_by)', () => {
    const a = CustomLists.create(dto);
    expect(() => a.delete({})).toThrow();
  });
});

describe('Value Objects', () => {
  it('ValueObjectCustomListsName: valid/invalid', () => {
    expect(() => new ValueObjectCustomListsName('OK')).not.toThrow();
    expect(() => new ValueObjectCustomListsName('')).toThrow("customlists_name: The value cannot be null");
  });

  it('ValueObjectAuxEntity: snake_case and non-empty', () => {
    expect(() => new ValueObjectAuxEntity('aux_countries')).not.toThrow();
    expect(() => new ValueObjectAuxEntity('Bad Case')).toThrow(/Invalid "aux_entity"/i);
    expect(() => new ValueObjectAuxEntity('')).toThrow(/Invalid "aux_entity"/i);
  });
});

describe('CustomListResponse', () => {
  it('maps aggregate to JSON', () => {
    const a = CustomLists.create(CustomListMother.dto());
    const json = new CustomListResponse(a).toJson();

    expect(json).toEqual({
      data: {
        id: a.id.value,
        name: a.name.value,
        is_active: a.is_active.value,
        aux_entity: a.aux_entity.value,
        aux_items: a.aux_items.map(it => ({ literal: it.literal ?? it.literal, order: it.order })),
        groups: a.groups.map(g => g.value ?? g),
        created_at: a.created_at.value ?? null,
        updated_at: a.updated_at.value ?? null,
        created_by: a.created_by.value ?? null,
        updated_by: a.updated_by.value ?? null,
        deleted_at: a.deleted_at.value ?? null,
        deleted_by: a.deleted_by.value ?? null,
      },
    });
  });

  it('returns empty object if aggregate is null', () => {
    const json = new CustomListResponse(null).toJson();
    expect(json).toEqual({ data: {} });
  });
});

describe('CustomListCollectionResponse', () => {
  it('maps a collection and includes count', () => {
    const a1 = CustomLists.create(CustomListMother.dto({ name: 'A' }));
    const a2 = CustomLists.create(CustomListMother.dto({ name: 'B' }));
    const collection = [a1, a2];

    const json = new CustomListCollectionResponse(collection, 2).toJson();

    expect(json).toEqual({
      data: {
        items: collection.map(a => new CustomListResponse(a).toJson().data),
      },
      metadata: { count: 2 },
    });
  });

  it('defaults count to collection length when not provided', () => {
    const a = CustomLists.create(CustomListMother.dto());
    const json = new CustomListCollectionResponse([a]).toJson();

    expect(json.metadata.count).toBe(1);
  });
});
