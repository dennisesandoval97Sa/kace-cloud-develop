import { v4 as uuidv4 } from 'uuid';
import { AllowedConnection } from '../../../src/allowed-conections';
import Chance from 'chance';

export default class AllowedConnectionsMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `AllowedConnection` entity.
     *
     * @param {Object} params - Optional parameters to override default values.
     * @returns {Object} The DTO containing the properties for an `AllowedConnection` entity.
     */
    static dto({ id, created_by, certificate = null, connection } = {}) {
        const chance = new Chance();
        return {
            id: id ?? uuidv4(),
            description: 'New description',
            connection: connection ?? chance.ip(),
            certificate: certificate,
            is_active: true,
            has_ssl: false,
            created_at: new Date().toISOString(),
            created_by: created_by ?? uuidv4(),
        };
    }

    /**
     * Creates an `AllowedConnection` instance and saves it to the repository.
     *
     * @param {Object} repository - The repository to save the `AllowedConnection` instance.
     * @param {Object} data - Optional data to override default values.
     * @returns {AllowedConnection} The created `AllowedConnection` instance.
     */
    static async createAllowedConnection(repository, data = {}) {
        const allowedConnection = AllowedConnection.create(AllowedConnectionsMother.dto(data));
        await repository.save(allowedConnection);
        return allowedConnection;
    }
}
