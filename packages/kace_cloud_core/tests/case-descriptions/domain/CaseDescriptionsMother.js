import { v4 as uuidv4 } from 'uuid';
import { CaseDescription } from '../../../src/case-descriptions';

export default class CaseDescriptionsMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `CaseDescription` entity.
     *
     * @returns {Object} The DTO containing the properties for a `CaseDescription` entity.
     */
    static dto(override = {}) {
        return {
            id: uuidv4(),
            descripcion: 'Descripción de prueba',
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
            ...override,
        };
    }

    /**
     * Creates a `CaseDescription` instance and saves it to the repository.
     *
     * @param {KnexCaseDescriptionRepository} repository - The repository to save the `CaseDescription` instance.
     * @param {Object} data - Optional data to customize the `CaseDescription` instance.
     * @returns {Promise<CaseDescription>} The created `CaseDescription` instance.
     */
    static async createCaseDescription(repository, data = {}) {
        const caseDescription = CaseDescription.create(CaseDescriptionsMother.dto(data));
        await repository.save(caseDescription);
        return caseDescription;
    }
}
