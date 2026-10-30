import { AggregateRoot, ValueObjectBoolean, ValueObjectUuid } from '../../shared';
import { ValueObjectCustomListsName } from './ValueObjectCustomListsName';
import { ValueObjectAuxEntity } from './ValueObjectAuxEntity';

export class CustomLists extends AggregateRoot {
  #name; #is_active; #aux_entity;
  #aux_items = [];
  #groups = [];

  constructor({ 
    id,
    name,
    is_active,
    aux_entity,
    aux_items = [],
    groups = [],
    created_at,
    created_by,
    updated_at,
    updated_by,
    deleted_at,
    deleted_by
  }) {
    super(id);
    this.#name = new ValueObjectCustomListsName(name);
    this.#is_active = new ValueObjectBoolean('is_active', is_active ?? true);
    this.#aux_entity = new ValueObjectAuxEntity(aux_entity);

    this.setAuxItems(aux_items);
    this.setGroups(groups);

    this.created_at = created_at;
    this.created_by = created_by;
    this.updated_at = updated_at;
    this.updated_by = updated_by;
    this.deleted_at = deleted_at;
    this.deleted_by = deleted_by;

    this.flushChanges();
  }

  get name() {
    return this.#name;
  }

  set name(value) {
    if (this.#name.value !== value) { 
      this.#name = new ValueObjectCustomListsName(value);
      this.changedAttributes.name = this.#name.value; 
    }
  }

  get is_active() {
    return this.#is_active;
  }

  set is_active(value) {
    if (this.#is_active.value !== value) {
      this.#is_active = new ValueObjectBoolean('is_active', value);
      this.changedAttributes.is_active = this.#is_active.value; 
    }
  }

  get aux_entity() {
    return this.#aux_entity;
  }

  set aux_entity(value){
    if (this.#aux_entity.value !== value){
      this.#aux_entity = new ValueObjectAuxEntity(value);
      this.changedAttributes.aux_entity = this.#aux_entity.value;
    }
  }

  get aux_items(){
    return this.#aux_items.slice();
  }

  set aux_items(items) {
    this.setAuxItems(items);
  }

  setAuxItems(items = []) {
    const normalized = items.map((it, i) => ({
      literal: it.literal,
      order: Number.isInteger(it.order) ? it.order : (i + 1),
    }));

    this.#aux_items = normalized;
    this.changedAttributes.aux_items = this.#aux_items;
  }

  get groups(){
    return this.#groups.slice();
  }

  set groups(ids) { this.setGroups(ids); }
  setGroups(groupIds = []) {
    const normalized = groupIds.map(g => new ValueObjectUuid('group_id', g, true).value);
    this.#groups = Array.from(new Set(normalized));
    this.changedAttributes.groups = this.#groups;
  }

  static create(dto){
    return new CustomLists(dto);
  }

  getchangedAttributes(){
    return this.changedAttributes;
  }
}
