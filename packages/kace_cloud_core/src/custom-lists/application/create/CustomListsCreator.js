import { CustomError, Helper } from '../../../shared/index.js';
import { v4 as uuid } from 'uuid';

export class CustomListsCreator {
  #repository;

  /**
   * @param {KnexCustomListRepository} repository
   */
  constructor(repository) {
    this.#repository = repository;
  }

  /**
   * Crea una custom_list + relaciones en una transacción
   * @param {Object} dto
   */
  async execute(dto) {
    const id = dto.id ?? uuid();

    if (!dto.name || typeof dto.name !== 'string') {
      throw new CustomError('Invalid "name"', 400);
    }
    if (!dto.aux_entity || typeof dto.aux_entity !== 'string') {
      throw new CustomError('Invalid "aux_entity"', 400);
    }

    const duplicated = await this.#repository.existsByNameAndEntity(dto.name.trim(), dto.aux_entity.trim());
    if (duplicated) {
      throw new CustomError(`Custom List "${dto.name}" already exists for entity "${dto.aux_entity}"`, 400);
    }

    const auxItems = Array.isArray(dto.aux_items) ? dto.aux_items : [];
    for (const it of auxItems) {
      if (!it?.literal) {
        throw new CustomError('Each item in "aux_items" must include "literal"', 400);
      }
    }

    const groups = Array.isArray(dto.groups) ? dto.groups : [];

    const now = new Date().toISOString();
    const payload = {
      id,
      name: dto.name.trim(),
      is_active: dto.is_active ?? true,
      aux_entity: dto.aux_entity.trim(),
      aux_items: auxItems.map((it, idx) => ({
        literal: it.literal,
        order: Number.isInteger(it.order) ? it.order : (idx + 1),
      })),
      groups,
      created_at: dto.created_at ?? now,
      created_by: dto.created_by,
      updated_at: null,
      updated_by: null
    };

    await this.#repository.save(payload);
    Helper.logInfo(`Custom list created: ${payload.id}`);
    return { id: payload.id };
  }
}
