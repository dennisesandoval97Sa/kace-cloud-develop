import { v4 as uuidv4 } from 'uuid';
import { UserList } from '../../../src/user-lists';

export default class UserListMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `UserList` entity.
     *
     * @returns {Object} The DTO containing the properties for an `UserList` entity.
     */
    static dto({ lista_usuarios, group_id } = {}) {
        return {
            id: uuidv4(),
            descripcion: 'Descripción aleatoria',
            lista_usuarios: lista_usuarios ?? [
                { id: uuidv4(), name: 'user 1' },
                { id: uuidv4(), name: 'user 2' },
            ],
            is_active: true,
            group_id: group_id ?? uuidv4(),
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };
    }

    /**
     * Creates a `UserList` instance and saves it to the repository.
     *
     * @param {KnexUserListsRepository} repository - The repository to save the `UserList` instance.
     * @returns {UserList} The created `UserList` instance.
     */
    static async createUserList(repository, data = {}) {
        const userList = UserList.create(UserListMother.dto(data));
        await repository.save(userList);
        return userList;
    }
}
