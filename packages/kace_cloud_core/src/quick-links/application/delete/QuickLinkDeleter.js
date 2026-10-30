import { ValueObjectUuid } from '../../../shared/index.js';

/**
 * Caso de uso para eliminar lógicamente un enlace rápido.
 */
export class QuickLinkDeleter {
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * @param {string} id
     * @param {string} userId
     * @returns {Promise<boolean>}
     */
    async execute(id, userId) {
        const linkId = new ValueObjectUuid('id', id);
        const quickLink = await this.#repository.find(linkId.value);

        if (!quickLink) {
            return false;
        }

        quickLink.delete({
            deleted_at: new Date(),
            deleted_by: userId,
        });

        await this.#repository.delete(quickLink);

        return true;
    }
}
