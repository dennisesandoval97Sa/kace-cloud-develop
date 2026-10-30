import { CustomError } from '../../../shared/errors/CustomError.js';
import { ValueObjectUuid } from '../../../shared/index.js';

export class AuxUserUpdater {
    /** @type {KnexAuxUsersRepository} is initialized in the constructor */
    #repository;

    /**
     *
     * @param {KnexAuxUsersRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {object} dto Object data for update
     * @param {string} id record identificator for update
     */
    async execute(dto, id) {
        const auxUserId = new ValueObjectUuid('auxUserId', id);
        const auxUser = await this.#repository.find(auxUserId);

        if (!auxUser) {
            throw new CustomError('Aux user you try update does not exist', 404);
        }

        const originalValues = auxUser.toJson();
        auxUser.update(dto);

        await this.#repository.update(auxUser);
        await this.#repository.saveHistory(auxUser, originalValues);

        auxUser.flushChanges();

        return true;
    }
}
