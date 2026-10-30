import { RelationsRepository } from '../../../infrastructure/relations/RelationsRepository.js';
import { RelationsCollectionResponse } from './RelationsCollectionResponse.js';
import { ValidationFailError } from '../../../errors/ValidationFailError.js';
/**
 * @class RelationsGetByEntityService
 * @description Application service that retrieves relations for a given entity.
 */
export class RelationsGetByEntityService {
  /** @type {RelationsRepository} */
  #repository;

  constructor(repository, definitionsRepository) {
    this.#repository = new RelationsRepository();
  }

  /**
   * Executes the use case.
   * @param {string } entity
   * @returns {RelationsCollectionResponse}
   */
  execute(entity) {
   if (!entity) {
      throw new ValidationFailError('RelationsGetByEntityService: "entity" is required', 'entity');
    }

    const relations = this.#repository.findByEntity(entity);
    return new RelationsCollectionResponse(relations);
  }
}
