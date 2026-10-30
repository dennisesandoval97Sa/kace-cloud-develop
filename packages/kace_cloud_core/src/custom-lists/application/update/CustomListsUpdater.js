import { DomainCustomListsFinder } from '../../domain/DomainCustomListsFinder .js';
import { Helper, CustomError } from '../../../shared/index.js';

/**
 * Updater de CustomList
 * - Valida unicidad (name + aux_entity)
 * - Actualiza campos escalares (name, is_active, aux_entity)
 * - Reemplaza colecciones (aux_items, groups) cuando vienen en el dto
 */
export class CustomListsUpdater {
  /** @type {import('../infrastructure/KnexCustomListsRepository.js').KnexCustomListsRepository} */
  #repository;
  /** @type {DomainCustomListsFinder } */
  #finder;

  /**
   * @param {import('../infrastructure/KnexCustomListsRepository.js').KnexCustomListsRepository} repository
   */
  constructor(repository) {
    this.#repository = repository;
    this.#finder = new DomainCustomListsFinder (repository);
  }

  /**
   * @param {string} id
   * @param {{
   *   name?: string,
   *   is_active?: boolean,
   *   aux_entity?: string,
   *   aux_items?: Array<{ literal: string, order?: number }>,
   *   groups?: string[],
   *   updated_by?: string,
   *   updated_at?: string
   * }} dto
   */
  async execute(id, dto = {}) {

    const aggregate = await this.#finder.execute(id);
    if (!aggregate) {
      throw new CustomError(`CustomList with ID ${id} does not exist.`, 404);
    }

    const newName = dto.name ?? aggregate.name.value;
    const newAuxEntity = dto.aux_entity ?? aggregate.aux_entity.value;

    const nameChanged = dto.name !== undefined && dto.name !== aggregate.name.value;
    const entityChanged = dto.aux_entity !== undefined && dto.aux_entity !== aggregate.aux_entity.value;
    if (nameChanged || entityChanged) {
      const exists = await this.#repository.existsByNameAndEntity(newName.trim(), newAuxEntity.trim());

      if (exists && !(newName === aggregate.name.value && newAuxEntity === aggregate.aux_entity.value)) {
        throw new CustomError(`Custom List "${newName}" already exists for entity "${newAuxEntity}"`, 409);
      }
    }

    if (dto.name !== undefined) aggregate.name = dto.name;
    if (dto.is_active !== undefined) aggregate.is_active = dto.is_active;
    if (dto.aux_entity !== undefined) aggregate.aux_entity = dto.aux_entity;

    if (Array.isArray(dto.aux_items)) {
      aggregate.setAuxItems(dto.aux_items);
    }
    if (Array.isArray(dto.groups)) {
      aggregate.setGroups(dto.groups);
    }

    aggregate.updated_by = dto.updated_by ?? aggregate.updated_by ?? null;
    aggregate.updated_at = dto.updated_at ?? new Date().toISOString();

    await this.#repository.update(aggregate);

    aggregate.flushChanges?.();
    Helper.logInfo(`CustomList updated: ${aggregate.id.value}`);
  }
}
