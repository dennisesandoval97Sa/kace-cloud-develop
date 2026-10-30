import { globalSystemUserId } from '../seeds/20241125105900_usuario_base.js';

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    const createdBy = globalSystemUserId;
    const now = new Date().toISOString();

    // 1. ws_rest_conditionals
    await knex('ws_rest_conditionals').insert({
        id: 'b823062a-8944-456c-8de1-1c7a42c2adda',
        satisfied: '61483b30-8e86-469f-9dd6-001c767a9ad7',
        unsatisfied: '769e4762-f315-41a6-bc26-89085c2f3749',
        input_path_a: 'channel_hub.connection_id',
        input_path_b: null,
        operator: 'notNull',
        created_at: now,
        created_by: createdBy,
    });

    // 2. ws_rest_endpoints
    await knex('ws_rest_endpoints').insert([
        {
            id: '06cf3374-f17b-4109-8d37-b16584f91a73',
            type: 'authorization',
            description: 'Channel Hub - auth',
            url: 'https://ch-tst.auth.eu-west-1.amazoncognito.com/oauth2/token',
            method: 'POST',
            headers:
                '{"headers":{"Content-Type":"application/x-www-form-urlencoded","Authorization":"Basic SECRET_CHANNEL_HUB_AUTH"}}',
            body: '{"body":{"grant_type":"client_credentials"}}',
            is_dynamic_body: true,
            is_active: true,
            created_at: now,
            created_by: createdBy,
            updated_at: now,
            updated_by: createdBy,
            deleted_at: null,
            deleted_by: null,
            authorization_id: null,
            is_dynamic_header: true,
            filter_input: '{"filter_input": ["access_token"]}',
            context_position: 'channel_hub.auth',
            on_success: '{"on_success": {}}',
            on_error: '{"on_error": {}}',
            attempts: 0,
            initial_context: '{"initial_context": {}}',
        },
        {
            id: '9867f4fd-67b5-4004-b3dc-4016b6134a8e',
            type: 'consumption',
            description: 'Channel Hub - Obtener connection-id',
            url: 'https://api.konecta.cloud/one-channel-hub/tst/v1/connection/user/context.id',
            method: 'GET',
            headers: '{"headers":{"Authorization":"Bearer context.channel_hub.auth.access_token"}}',
            body: '{"body":{}}',
            is_dynamic_body: true,
            is_active: true,
            created_at: now,
            created_by: createdBy,
            updated_at: now,
            updated_by: createdBy,
            deleted_at: null,
            deleted_by: null,
            authorization_id: '06cf3374-f17b-4109-8d37-b16584f91a73',
            is_dynamic_header: true,
            filter_input: '{"filter_input": ["connection"]}',
            context_position: 'channel_hub.connection',
            on_success: '{"on_success": {}}',
            on_error: '{"on_error": {}}',
            attempts: 0,
            initial_context: '{"initial_context": {}}',
        },
        {
            id: '22d39ff5-7b42-46b3-93b6-b78c193863ce',
            type: 'consumption',
            description: 'Channel Hub - Crear connection',
            url: 'https://api.konecta.cloud/one-channel-hub/tst/v1/connection/email',
            method: 'POST',
            headers: '{"headers":{"Authorization":"Bearer context.channel_hub.auth.access_token"}}',
            body: '{"body":{"user":"context.channel_hub.user","countryId":"context.channel_hub.countryId","customerId":"context.channel_hub.customerId","serviceId":"context.channel_hub.serviceId","channelId":"context.channel_hub.channelId","operatorId":"context.channel_hub.operatorId","providerAccountId":"context.channel_hub.providerAccountId","limits":"context.channel_hub.limits","billing":"context.channel_hub.billing","webhooks":"context.channel_hub.webhooks","serviceOwner":"context.channel_hub.serviceOwner","operator":"context.channel_hub.operator"}}',
            is_dynamic_body: true,
            is_active: true,
            created_at: now,
            created_by: createdBy,
            updated_at: now,
            updated_by: createdBy,
            deleted_at: null,
            deleted_by: null,
            authorization_id: '06cf3374-f17b-4109-8d37-b16584f91a73',
            is_dynamic_header: true,
            filter_input: '{"filter_input": []}',
            context_position: 'channel_hub.connection_response',
            on_success: '{"on_success": {}}',
            on_error: '{"on_error": {}}',
            attempts: 0,
            initial_context: '{"initial_context": {}}',
        },
    ]);

    // 3. ws_rest_flows
    await knex('ws_rest_flows').insert([
        {
            id: '3a380e52-db54-42e7-b6a9-9068db414705',
            description: 'Channel Hub - Crear/Actualizar conexion - satisfied branch',
            is_active: false,
            created_at: now,
            created_by: createdBy,
            updated_at: now,
            updated_by: null,
            deleted_at: null,
            deleted_by: null,
            external_code: 'channelhub-connection_satisfied',
            json_diagram_properties:
                '{"edges": [{"id": "reactflow__edge-2f0e4e96-b394-4ef5-a17a-e2e9fbef8478yes-a2da008f-6155-458e-8e04-b9eb2a6100e6", "type": "custom", "source": "2f0e4e96-b394-4ef5-a17a-e2e9fbef8478", "target": "a2da008f-6155-458e-8e04-b9eb2a6100e6", "sourceHandle": "yes", "targetHandle": null}], "nodes": [{"id": "2f0e4e96-b394-4ef5-a17a-e2e9fbef8478", "data": {"id": "b823062a-8944-456c-8de1-1c7a42c2adda", "type": "conditional", "label": "Si channel_hub.connection_id notNull", "value": "", "filter": "channel_hub.connection_id", "operator": "notNull", "subflows": {}, "conditionType": "notNull"}, "type": "conditional", "style": {"wordBreak": "break-word"}, "width": 120, "height": 120, "dragging": false, "position": {"x": 300, "y": 304}, "selected": false, "positionAbsolute": {"x": 300, "y": 304}}, {"id": "a2da008f-6155-458e-8e04-b9eb2a6100e6", "data": {"id": "9867f4fd-67b5-4004-b3dc-4016b6134a8e", "type": "endpoint", "label": "Channel Hub - Obtener connection-id"}, "style": {"color": "black", "wordBreak": "break-word", "backgroundColor": "rgb(232, 196, 104)"}, "width": 150, "height": 58, "dragging": false, "position": {"x": 566, "y": 387}, "selected": false, "positionAbsolute": {"x": 566, "y": 387}}]}',
            is_primary: false,
            initial_context: null,
        },
        {
            id: '4f7f9d13-65b9-445d-a839-d8e0ece2ed03',
            description: 'Channel Hub - Crear/Actualizar conexion',
            is_active: true,
            created_at: now,
            created_by: createdBy,
            updated_at: now,
            updated_by: createdBy,
            deleted_at: null,
            deleted_by: null,
            external_code: 'channelhub-connection',
            json_diagram_properties:
                '{"edges": [{"id": "reactflow__edge-0-2f0e4e96-b394-4ef5-a17a-e2e9fbef8478in", "type": "custom", "source": "0", "target": "2f0e4e96-b394-4ef5-a17a-e2e9fbef8478", "sourceHandle": null, "targetHandle": "in"}, {"id": "reactflow__edge-2f0e4e96-b394-4ef5-a17a-e2e9fbef8478yes-a2da008f-6155-458e-8e04-b9eb2a6100e6", "type": "custom", "source": "2f0e4e96-b394-4ef5-a17a-e2e9fbef8478", "target": "a2da008f-6155-458e-8e04-b9eb2a6100e6", "sourceHandle": "yes", "targetHandle": null}, {"id": "reactflow__edge-2f0e4e96-b394-4ef5-a17a-e2e9fbef8478no-6957b09d-8634-4d13-986e-f54b3edb86c5", "type": "custom", "source": "2f0e4e96-b394-4ef5-a17a-e2e9fbef8478", "target": "6957b09d-8634-4d13-986e-f54b3edb86c5", "sourceHandle": "no", "targetHandle": null}], "nodes": [{"id": "0", "data": {"label": "inicio"}, "type": "input", "width": 150, "height": 40, "dragging": false, "position": {"x": 225, "y": 75}, "selected": false, "positionAbsolute": {"x": 0, "y": 0}}, {"id": "a2da008f-6155-458e-8e04-b9eb2a6100e6", "data": {"id": "9867f4fd-67b5-4004-b3dc-4016b6134a8e", "type": "endpoint", "label": "Channel Hub - Obtener connection-id"}, "style": {"color": "black", "wordBreak": "break-word", "backgroundColor": "rgb(232, 196, 104)"}, "width": 150, "height": 58, "dragging": false, "position": {"x": 566, "y": 387}, "selected": false, "positionAbsolute": {"x": 566, "y": 387}}, {"id": "2f0e4e96-b394-4ef5-a17a-e2e9fbef8478", "data": {"id": "b823062a-8944-456c-8de1-1c7a42c2adda", "type": "conditional", "label": "Si channel_hub.connection_id notNull", "value": "", "filter": "channel_hub.connection_id", "operator": "notNull", "conditionType": "notNull"}, "type": "conditional", "style": {"wordBreak": "break-word"}, "width": 120, "height": 120, "dragging": false, "position": {"x": 300, "y": 304}, "selected": false, "positionAbsolute": {"x": 300, "y": 304}}, {"id": "6957b09d-8634-4d13-986e-f54b3edb86c5", "data": {"id": "22d39ff5-7b42-46b3-93b6-b78c193863ce", "type": "endpoint", "label": "Channel Hub - Crear connection"}, "style": {"color": "black", "wordBreak": "break-word", "backgroundColor": "rgb(232, 196, 104)"}, "width": 150, "height": 58, "dragging": false, "position": {"x": 50.512500000000045, "y": 384}, "selected": false, "positionAbsolute": {"x": 50.512500000000045, "y": 384}}]}',
            is_primary: true,
            initial_context: null,
        },
        {
            id: '61483b30-8e86-469f-9dd6-001c767a9ad7',
            description: 'Channel Hub - Crear/Actualizar conexion - satisfied branch',
            is_active: false,
            created_at: now,
            created_by: createdBy,
            updated_at: now,
            updated_by: null,
            deleted_at: null,
            deleted_by: null,
            external_code: 'channelhub-connection_satisfied',
            json_diagram_properties:
                '{"edges": [{"id": "reactflow__edge-2f0e4e96-b394-4ef5-a17a-e2e9fbef8478yes-a2da008f-6155-458e-8e04-b9eb2a6100e6", "type": "custom", "source": "2f0e4e96-b394-4ef5-a17a-e2e9fbef8478", "target": "a2da008f-6155-458e-8e04-b9eb2a6100e6", "sourceHandle": "yes", "targetHandle": null}], "nodes": [{"id": "2f0e4e96-b394-4ef5-a17a-e2e9fbef8478", "data": {"id": "b823062a-8944-456c-8de1-1c7a42c2adda", "type": "conditional", "label": "Si channel_hub.connection_id notNull", "value": "", "filter": "channel_hub.connection_id", "operator": "notNull", "subflows": {}, "conditionType": "notNull"}, "type": "conditional", "style": {"wordBreak": "break-word"}, "width": 120, "height": 120, "dragging": false, "position": {"x": 300, "y": 304}, "selected": false, "positionAbsolute": {"x": 300, "y": 304}}, {"id": "a2da008f-6155-458e-8e04-b9eb2a6100e6", "data": {"id": "9867f4fd-67b5-4004-b3dc-4016b6134a8e", "type": "endpoint", "label": "Channel Hub - Obtener connection-id"}, "style": {"color": "black", "wordBreak": "break-word", "backgroundColor": "rgb(232, 196, 104)"}, "width": 150, "height": 58, "dragging": false, "position": {"x": 566, "y": 387}, "selected": false, "positionAbsolute": {"x": 566, "y": 387}}]}',
            is_primary: false,
            initial_context: null,
        },
        {
            id: '769e4762-f315-41a6-bc26-89085c2f3749',
            description: 'Channel Hub - Crear/Actualizar conexion - unsatisfied branch',
            is_active: false,
            created_at: now,
            created_by: createdBy,
            updated_at: now,
            updated_by: null,
            deleted_at: null,
            deleted_by: null,
            external_code: 'channelhub-connection_unsatisfied',
            json_diagram_properties:
                '{"edges": [{"id": "reactflow__edge-2f0e4e96-b394-4ef5-a17a-e2e9fbef8478no-6957b09d-8634-4d13-986e-f54b3edb86c5", "type": "custom", "source": "2f0e4e96-b394-4ef5-a17a-e2e9fbef8478", "target": "6957b09d-8634-4d13-986e-f54b3edb86c5", "sourceHandle": "no", "targetHandle": null}], "nodes": [{"id": "2f0e4e96-b394-4ef5-a17a-e2e9fbef8478", "data": {"id": "b823062a-8944-456c-8de1-1c7a42c2adda", "type": "conditional", "label": "Si channel_hub.connection_id notNull", "value": "", "filter": "channel_hub.connection_id", "operator": "notNull", "subflows": {}, "conditionType": "notNull"}, "type": "conditional", "style": {"wordBreak": "break-word"}, "width": 120, "height": 120, "dragging": false, "position": {"x": 300, "y": 304}, "selected": false, "positionAbsolute": {"x": 300, "y": 304}}, {"id": "6957b09d-8634-4d13-986e-f54b3edb86c5", "data": {"id": "22d39ff5-7b42-46b3-93b6-b78c193863ce", "type": "endpoint", "label": "Channel Hub - Crear connection"}, "style": {"color": "black", "wordBreak": "break-word", "backgroundColor": "rgb(232, 196, 104)"}, "width": 150, "height": 58, "dragging": false, "position": {"x": 50.512500000000045, "y": 384}, "selected": false, "positionAbsolute": {"x": 50.512500000000045, "y": 384}}]}',
            is_primary: false,
            initial_context: null,
        },
    ]);

    // 4. ws_rest_workflow_steps
    await knex('ws_rest_workflow_steps').insert([
        {
            id: '4c941405-823b-43ac-a103-fac54245d8d6',
            flow_id: '3a380e52-db54-42e7-b6a9-9068db414705',
            order: 1,
            endpoint_id: '9867f4fd-67b5-4004-b3dc-4016b6134a8e',
            function_id: null,
            created_at: now,
            created_by: createdBy,
            updated_at: now,
            updated_by: null,
            deleted_at: null,
            deleted_by: null,
            parent_step_id: null,
            conditional_id: null,
        },
        {
            id: '39a92866-2f71-4407-8e4f-ffd92ab48d61',
            flow_id: '4f7f9d13-65b9-445d-a839-d8e0ece2ed03',
            order: 1,
            endpoint_id: null,
            function_id: null,
            created_at: now,
            created_by: createdBy,
            updated_at: now,
            updated_by: null,
            deleted_at: null,
            deleted_by: null,
            parent_step_id: null,
            conditional_id: 'b823062a-8944-456c-8de1-1c7a42c2adda',
        },
        {
            id: '8db9332e-1edd-4dc3-91ee-d4faad8fbebd',
            flow_id: '61483b30-8e86-469f-9dd6-001c767a9ad7',
            order: 1,
            endpoint_id: '9867f4fd-67b5-4004-b3dc-4016b6134a8e',
            function_id: null,
            created_at: now,
            created_by: createdBy,
            updated_at: now,
            updated_by: null,
            deleted_at: null,
            deleted_by: null,
            parent_step_id: null,
            conditional_id: null,
        },
        {
            id: 'f629b932-d08f-4b1a-8731-f0a8c0e72d67',
            flow_id: '769e4762-f315-41a6-bc26-89085c2f3749',
            order: 1,
            endpoint_id: '22d39ff5-7b42-46b3-93b6-b78c193863ce',
            function_id: null,
            created_at: now,
            created_by: createdBy,
            updated_at: now,
            updated_by: null,
            deleted_at: null,
            deleted_by: null,
            parent_step_id: null,
            conditional_id: null,
        },
    ]);
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    // Remove in reverse order of insertion (respect FK constraints)
    await knex('ws_rest_workflow_steps')
        .whereIn('id', [
            '4c941405-823b-43ac-a103-fac54245d8d6',
            '39a92866-2f71-4407-8e4f-ffd92ab48d61',
            '8db9332e-1edd-4dc3-91ee-d4faad8fbebd',
            'f629b932-d08f-4b1a-8731-f0a8c0e72d67',
        ])
        .del();

    await knex('ws_rest_flows')
        .whereIn('id', [
            '3a380e52-db54-42e7-b6a9-9068db414705',
            '4f7f9d13-65b9-445d-a839-d8e0ece2ed03',
            '61483b30-8e86-469f-9dd6-001c767a9ad7',
            '769e4762-f315-41a6-bc26-89085c2f3749',
        ])
        .del();

    // Delete the two consumption endpoints inserted by this migration
    await knex('ws_rest_endpoints')
        .whereIn('id', ['9867f4fd-67b5-4004-b3dc-4016b6134a8e', '22d39ff5-7b42-46b3-93b6-b78c193863ce'])
        .del();
    // Clear any remaining references to the auth endpoint (e.g. from seeds) before deleting it
    await knex('ws_rest_endpoints')
        .where('authorization_id', '06cf3374-f17b-4109-8d37-b16584f91a73')
        .update({ authorization_id: null });
    await knex('ws_rest_endpoints').where('id', '06cf3374-f17b-4109-8d37-b16584f91a73').del();

    await knex('ws_rest_conditionals').where('id', 'b823062a-8944-456c-8de1-1c7a42c2adda').del();
}
