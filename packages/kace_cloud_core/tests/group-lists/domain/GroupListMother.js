import { v4 as uuidv4 } from 'uuid';
import { GroupList } from '../../../src/group-lists';

export default class GroupListMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `GroupList` entity.
     * @param {Groups} group - The group to be added
     * @returns {Object} The DTO containing the properties for an `GroupList` entity.
     */
    static dto(group = null) {
        const groupList = group ? [{ id: group.id.value }] : [{ id: uuidv4() }];

        const id = uuidv4();
        return {
            id: id,
            descripcion: `Descripción aleatoria  ${id.replace(/[^a-zA-Z]/g, '')}`,
            lista_grupos: groupList,
            is_active: true,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };
    }

    /**
     * Creates a `GroupList` instance and saves it to the repository.
     *
     * @param {KnexGroupListsRepository} repository - The repository to save the `GroupList` instance.
     * @returns {GroupList} The created `GroupList` instance.
     */
    static async createGroupList(repository, group) {
        const groupList = GroupList.create(GroupListMother.dto(group));
        await repository.save(groupList);
        return groupList;
    }
}
