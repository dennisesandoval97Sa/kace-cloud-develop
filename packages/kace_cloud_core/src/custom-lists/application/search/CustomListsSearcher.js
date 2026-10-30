import { Criteria } from '../../../shared/criteria/Criteria.js';
import { Counter } from '../../../shared/domain/Counter.js';
import { CustomListCollectionResponse } from '../CustomListCollectionResponse.js';

/**
 * @typedef {import('../infrastructure/KnexCustomListsRepository.js').KnexCustomListsRepository} KnexCustomListsRepository
 */
export class CustomListsSearcher {
  /** @type {KnexCustomListsRepository} */
  #repository;
  /** @type {Counter} */
  #counter;

  /**
   * @param {KnexCustomListsRepository} repository
   */
  constructor(repository) {
    this.#repository = repository;
    this.#counter = new Counter(repository);
  }

  /**
   * Busca custom lists según criterios.
   * @param {{filter?:any, relationship?:any, limit?:number, offset?:number, order?:any}} dto
   * @returns {Promise<CustomListCollectionResponse>}
   */
  async execute({ filter, relationship, limit, offset, order }) {
    const tablename = this.#repository.tableName;
    const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);

    const rows = await this.#repository.search(criteria);

    const count = await this.#counter.execute({ filter, relationship });

    return new CustomListCollectionResponse(rows, count);
  }
}
