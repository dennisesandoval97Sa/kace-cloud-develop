import { CustomError } from '../../../shared';
import { DomainCustomListsFinder , CustomListResponse } from '../../index.js';

export class CustomListsFinder {
  /** @type {DomainCustomListsFinder} is initialized in the constructor */
  #finder;

  /**
   * Creates an instance of `CustomListsFinder`.
   *
   * @param {KnexCustomListsRepository} repository - The repository used to access the `Literal` data.
   */
  constructor(repository) {
    this.#finder = new DomainCustomListsFinder(repository);
  }

  /**
   * Executes the finding of a `CustomLists` object by its unique identifier.
   *
   * @param {string} id - The unique identifier of the `CustomLists` object to find.
   * @returns {Promise<CustomListResponse>} A promise that resolves to a `CustomListResponse` object containing the found `CustomLists` data.
   */
  async execute(id) {
    const customlist = await this.#finder.execute(id);
    if (!customlist || customlist.isDeleted()) {
      throw new CustomError('CustomLists not found', 404);
    }
    return new CustomListResponse(customlist);
  }
}
