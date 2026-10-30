import { RoleFinderDomain } from '../..';
import { ValidationFailError } from '../../../shared/errors/ValidationFailError';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator';
import { AuxDefinitionValidator } from '../../validation/AuxDefinitionValidator';

export class RoleUpdater {
    /** @type {KnexRoleRepository} is initialized in the constructor */
    #repository;

    /** @type {RoleFinderDomain} is initialized in the constructor */
    #finder;
    /** @type {UniquenessValidator} is initialized in the constructor  */
    #uniquenessValidator;
    /** @type {AuxDefinitionValidator} */
    #auxDefinitionValidator;

    /**
     *
     * @param {KnexRoleRepository} repository
     * @param {KnexAuxDefinitionRepository} auxDefinitionRepository
     */
    constructor(repository, auxDefinitionRepository) {
        this.#repository = repository;
        this.#finder = new RoleFinderDomain(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
        this.#auxDefinitionValidator = new AuxDefinitionValidator(auxDefinitionRepository);
    }

    /**
     *
     * @param {object} dto object data for update
     * @param {string} id id role to update
     * @returns {Promise<void>}
     */

    async execute(dto, id) {
        const role = await this.#finder.execute(id);
        if (role === null) {
            throw new ValidationFailError('The role you are trying update does not exist', 'role');
        }

        if (dto.descripcion) {
            await this.#uniquenessValidator.validate('descripcion', dto.descripcion, id);
        }

        if (dto.permisos?.auxiliaries) {
            await this.#auxDefinitionValidator.validate(dto?.permisos?.auxiliaries);
        }

        const originalValues = role.toJson();
        role.update(dto);

        await this.#repository.update(role);
        await this.#repository.saveHistory(role, originalValues);
        role.flushChanges();
    }
}
