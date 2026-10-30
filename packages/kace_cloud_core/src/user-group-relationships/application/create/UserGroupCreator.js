import { UserGroupRelationship } from '../../index';

export class UserGroupCreator {
    /** @type {KnexUserGroupRelationshipRepository} is initialized in the constructor */
    #repository;
    /** @type {IdsValidator} is initialized in the constructor */
    #idsValidator;

    /**
     * Creates an instance of `UserGroupCreator`.
     *
     * @param {KnexUserGroupRelationshipRepository} repository - The repository used to save user group relation.
     */
    constructor(repository, idsValidator) {
        this.#repository = repository;
        this.#idsValidator = idsValidator;
    }

    /**
     * Executes the process of creating a new user group relation.
     * @param {Object} dto - The data transfer object containing the properties for the User Group Relation object.
     *   - `usuario_id` (string): The unique identifier of the user in the relationship.
     *   - `grupo_id` (string): The unique identifier of the group in the relationship.
     * @returns {Promise<void>}
     */
    async execute(dto) {
        await this.#idsValidator.validateUserIds([dto.usuario_id]);
        await this.#idsValidator.validateGroupIds([dto.grupo_id]);

        const userGroupRelation = new UserGroupRelationship(dto);
        await this.#repository.save(userGroupRelation);
    }
}
