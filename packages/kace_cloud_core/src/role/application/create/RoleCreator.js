import { ValidationFailError } from '../../../shared/errors/ValidationFailError';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator';
import { Role, RoleFinderDomain } from '../../index';
import { AuxDefinitionValidator } from '../../validation/AuxDefinitionValidator';

export class RoleCreator {
    /** * @type {KnexRoleRepository} is initialized in the constructor */
    #repository;
    /** @type {RoleFinderDomain} is initialized in the constructor */
    #finder;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;
    /** @type {AuxDefinitionValidator} */
    #auxDefinitionValidator;

    /**
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
     * @param {object} dto object data for insert
     * @returns {Promise<void>}
     */
    async execute(dto) {
        if (dto === null || dto === undefined) throw new ValidationFailError('dto cannot be null or undefined', 'dto');

        if (!this.#validatePermissionsSelected(dto.permisos)) {
            throw new ValidationFailError(`You have not selected any permission`, 'permisos');
        }

        if (dto.permisos?.auxiliaries) {
            await this.#auxDefinitionValidator.validate(dto.permisos.auxiliaries);
        }

        const roleCreator = new Role(dto);
        const result = await this.#finder.execute(roleCreator.id.value);
        if (result) {
            throw new ValidationFailError(`Role with id ${roleCreator.id.value} already exists`, 'id');
        }

        await this.#uniquenessValidator.validate('descripcion', dto.descripcion);
        await this.#repository.save(roleCreator);
        await this.#repository.saveHistory(roleCreator);
    }

    #validatePermissionsSelected(permissions) {
        const permisosSeleccionados = Object.values(permissions).some((rolePermissions) =>
            rolePermissions.some((permission) => permission.granted)
        );
        return permisosSeleccionados;
    }
}
