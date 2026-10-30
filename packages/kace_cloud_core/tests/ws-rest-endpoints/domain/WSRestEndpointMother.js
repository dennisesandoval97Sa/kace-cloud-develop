import { v4 as uuidv4 } from 'uuid';
import { WSRestEndpoint } from '../../../src/ws-rest-endpoints';

export default class WSRestEndpointMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `WSRestEndpoint` entity.
     *
     * @returns {Object} The DTO containing the properties for a `WSRestEndpoint` entity.
     */
    static dto({
        id,
        description,
        type,
        url,
        method,
        headers,
        body,
        body_type,
        is_dynamic_body,
        is_active,
        authorization_id,
        created_at,
        created_by,
        is_dynamic_header,
        filter_input,
        context_position,
        on_success,
        on_error,
        attempts,
    } = {}) {
        return {
            id: id ?? uuidv4(),
            type: type ?? 'authorization',
            description: description ?? `Default endpoint description ${uuidv4()}`,
            url: url ?? 'https://api.example.com/endpoint',
            method: method ?? 'POST',
            headers: headers ?? { headers: { 'content-type': 'application/json' } },
            body: body ?? { body: { user: 'admin_kace' } },
            body_type: body_type ?? 'json',
            is_dynamic_body: is_dynamic_body ?? false,
            is_active: is_active ?? true,
            authorization_id: authorization_id ?? null,
            created_at: created_at ?? new Date().toISOString(),
            created_by: created_by ?? uuidv4(),
            is_dynamic_header: is_dynamic_header ?? false,
            filter_input: filter_input ?? { filter_input: ['data.data', 'data.status', 'data.message'] },
            context_position: context_position ?? 'step_1',
            on_success: on_success ?? { on_success: { 200: uuidv4(), 201: uuidv4() } },
            on_error: on_error ?? { on_error: { 400: uuidv4(), 500: uuidv4() } },
            attempts: attempts ?? 0,
        };
    }

    /**
     * Creates a `WSRestEndpoint` instance and saves it to the repository.
     *
     * @param {KnexWSRestEndpointRepository} repository - The repository to save the `WSRestEndpoint` instance.
     * @returns {Promise<WSRestEndpoint>} The created `WSRestEndpoint` instance.
     */
    static async create(repository, data = {}) {
        const wsRestEndpoint = WSRestEndpoint.create(WSRestEndpointMother.dto(data));
        await repository.save(wsRestEndpoint);
        return wsRestEndpoint;
    }
}
