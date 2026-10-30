import { CustomError } from '../../../shared/index.js';
import { InteractionFinderDomain } from '../../domain/InteractionFinderDomain.js';

export class InteractionDeleter {
  /** @type {KnexInteractionRepository} is initialized in the constructor */
  #repository;

  /** @type {InteractionFinderDomain} is initialized in the constructor */
  #finder;

  /**
   *
   * @param {KnexInteractionRepository} repository
   */
  constructor(repository) {
    this.#repository = repository;
    this.#finder = new InteractionFinderDomain(repository);
  }

  /**
   *
   * @param {string} id id interaction for delete
   * @param {object} deleteDto object with data for delete the interaction, example {deletedAt: new Date(), deletedBy: 'user_id'}
   * @returns {Promise<Any>}
   */
  async execute(id, deleteDto) {
    const interaction = await this.#finder.execute(id);

    if (interaction === null) {
      throw new CustomError(`The interaction you are trying delete does not exist`, 404);
    }

    const originalValues = interaction.toJson();

    interaction.delete(deleteDto);
    await this.#repository.delete(interaction);
    await this.#repository.saveHistory(interaction, originalValues);

    interaction.flushChanges();
  }
}
