import { AuxUsers } from '../../domain/AuxUsers';

export class AuxUsersCreator {
    /**
     * @type {KnexAuxUsersRepository} repository
     * is initialized in the constructor
     */
    #repository;

    /**
     *
     * @param {KnexAuxUsersRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    async execute(dto) {
        const auxCases = AuxUsers.create(dto);
        await this.#repository.save(auxCases);
        await this.#repository.saveHistory(auxCases);
        return true;
    }
}
