import { v4 as uuidv4 } from 'uuid';
import { SubcasesRelationship } from '../../../src/cases/domain/SubcasesRelationship';

export default class SubcasesMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `SubcasesMother` entity.
     *
     * @returns {Object} The DTO containing the properties for an `SubcasesMother` entity.
     */
    static dto({ parent_case_id, child_case_id } = {}) {
        return {
            parent_case_id: parent_case_id ?? uuidv4(),
            child_case_id: child_case_id ?? uuidv4(),
        };
    }

    /**
     * Creates an `SubcasesRelationship` instance and saves it to the repository.
     *
     * @param {KnexSubcaseRelationshipRepository} repository - The repository to save the `UserGroupRelationship` instance.
     * @returns {SubcasesRelationship} The created `SubcasesRelationship` instance.
     */
    static async create(repository, data = {}) {
        const subcasesRelationship = SubcasesRelationship.create(SubcasesMother.dto(data));
        await repository.save(subcasesRelationship);
        return subcasesRelationship;
    }
}
