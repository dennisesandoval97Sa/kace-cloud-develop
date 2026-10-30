import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { ValidationFailError } from '../../../shared/errors/ValidationFailError.js';
import { KnexUsersRepository } from '../../infrastructure/KnexUsersRepository.js';

export class UserBulkUpdater {
    /** @type {KnexUsersRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    async execute(userIds, dto) {
        if (!Array.isArray(userIds) || userIds.length === 0) {
            throw new ValidationFailError('The user_ids array cannot be empty', 'user_ids');
        }

        const uniqueUserIds = [...new Set(userIds)];

        try {
            await this.#repository.withTransaction(async (trx) => {
                const users = await this.#repository.findByIds(uniqueUserIds, trx);

                if (users.length !== uniqueUserIds.length) {
                    const foundIds = new Set(users.map((user) => user.id.value));
                    const missingIds = uniqueUserIds.filter((userId) => !foundIds.has(userId));
                    throw new ValidationFailError(`Users with IDs ${missingIds.join(', ')} do not exist.`, 'user_ids');
                }

                const originalsById = new Map(users.map((user) => [user.id.value, user.toJson()]));

                for (const user of users) {
                    user.update(dto);
                }

                const changes = users[0].changedAttributes;
                await this.#repository.bulkUpdateByIds(uniqueUserIds, changes, trx);

                const chunkSize = 10;
                for (let i = 0; i < users.length; i += chunkSize) {
                    const chunk = users.slice(i, i + chunkSize);
                    await Promise.all(
                        chunk.map(async (user) => {
                            await this.#repository.saveHistory(user, originalsById.get(user.id.value), trx);
                            user.flushChanges();
                        })
                    );
                }
            });
        } catch (error) {
            Helper.logError('Error updating users in bulk', error);
            throw error;
        }
    }
}
