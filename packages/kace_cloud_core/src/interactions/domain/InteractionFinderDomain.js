import { ValueObjectUuid } from '../../shared/index.js';

export class InteractionFinderDomain {
  /**
   * @type {KnexInteractionRepository}
   * is initialized in the constructor
   */
  #repository;
  /**
   *
   * @param {KnexInteractionRepository} repository
   */
  constructor(repository) {
    this.#repository = repository;
  }

  /**
   *
   * @param {string} id id for find group
   * @returns {Promise<Interaction|null>}
   */
  async execute(id) {
    return this.#repository.find(new ValueObjectUuid('id', id));
  }
}
