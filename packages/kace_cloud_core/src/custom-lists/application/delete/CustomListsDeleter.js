import { DomainCustomListsFinder  } from '../../index.js';

export class CustomListsDeleter {
  /** @type {KnexCustomListsRepository} */
  #repository;
  /** @type {CustomListFinder} */
  #finder;

  /**
   * @param {KnexCustomListsRepository} repository
   */
  constructor(repository) {
    this.#repository = repository;
    this.#finder = new DomainCustomListsFinder(repository);
  }

  /**
   * Soft-delete de CustomList
   * @param {string} id
   * @param {{deleted_at:string, deleted_by:string}} dto
   */
  async execute(id, dto) {
    const aggregate = await this.#finder.execute(id);
    if (!aggregate) throw new Error(`CustomList with ID ${id} does not exist.`);

    aggregate.delete(dto);

    await this.#repository.update(aggregate);
    aggregate.flushChanges?.();
  }
}
