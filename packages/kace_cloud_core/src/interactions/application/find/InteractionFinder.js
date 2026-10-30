import { CustomError } from '../../../shared/index.js';
import { InteractionFinderDomain } from '../../domain/InteractionFinderDomain.js';
import { InteractionResponse } from '../InteractionResponse.js'

export class InteractionFinder {
  /** @type {InteractionFinderDomain} is initialized in the constructor*/
  #finder;

  /**
   *
   * @param {KnexInteractionRepository} repository
   */
  constructor(repository) {
    this.#finder = new InteractionFinderDomain(repository);
  }

  /**
   *
   * @param {string} id id for search
   * @returns {Promise<InteractionResponse>}
   */
  async execute(id) {
    const interaction = await this.#finder.execute(id);
    if (!interaction || interaction.isDeleted()) {
      throw new CustomError('Interaction not found', 404);
    }
    return new InteractionResponse(interaction);
  }
}
