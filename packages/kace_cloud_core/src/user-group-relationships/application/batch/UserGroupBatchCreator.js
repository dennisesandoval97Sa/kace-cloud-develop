import { UserGroupRelationship } from '../../domain/UserGroupRelationship';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';

export class UserGroupBatchCreator {
    /** @type {KnexUserGroupRelationshipRepository} is initialized in the constructor */
    #repository;
    /** @type {IdsValidator} is initialized in the constructor */
    #idsValidator;

    /**
     * Creates an instance of `UserGroupCreator`.
     *
     * @param {KnexUserGroupRelationshipRepository} repository - The repository used to save user group relation.
     */
    constructor(userGroupRepository, idsValidator) {
        this.#repository = userGroupRepository;
        this.#idsValidator = idsValidator;
    }

    /**
     * Handles batch creation of User-Group relationships.
     *
     * @param {Object[]} dto - List of UserGroupRelationship entities.
     *   - `usuario_id` (string): The unique identifier of the user in the relationship.
     *   - `grupo_id` (string): The unique identifier of the group in the relationship.
     * @param {string} actorId - The authenticated user id recorded as created_by in history.
     * @returns {Promise<void>}
     */
    async execute(dto, actorId) {
        if (!actorId) {
            throw new Error('actorId is required to record user-group relationship history.');
        }

        const userIds = dto.map((rel) => rel.usuario_id);
        const groupIds = dto.map((rel) => rel.grupo_id);

        await this.#idsValidator.validateUserIds(userIds);
        await this.#idsValidator.validateGroupIds(groupIds);

        const transaction = await this.#repository.startTransaction();
        const createdAt = new Date().toISOString();

        try {
            for (const relationship of dto) {
                const userGroup = UserGroupRelationship.create(relationship);
                await this.#repository.save(userGroup, transaction);
                await this.#repository.saveCreationHistory(userGroup, actorId, createdAt, transaction);
            }
            await transaction.commit();
        } catch (error) {
            Helper.logError(error);
            await transaction.rollback();
            throw new Error('Batch creation failed, transaction rolled back.');
        }
    }
}
