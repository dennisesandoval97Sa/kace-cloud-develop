import { v4 as uuidv4 } from 'uuid';
import { createSchema } from '../src/schemas.mjs';

describe('createSchema', () => {
    const validJsonFlujo = {
        nodes: [{ id: '0', type: 'input', data: { label: 'inicio' } }],
        edges: [
            {
                id: 'edge-1',
                source: '0',
                target: uuidv4(),
                data: { is_visible: true },
            },
        ],
    };

    it('accepts payload with server-injected id and ISO created_at', () => {
        const payload = {
            id: uuidv4(),
            nombre: 'Test flow',
            json_flujo: validJsonFlujo,
            status: 1,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };

        const result = createSchema.validate(payload, { abortEarly: false });
        expect(result.error).toBeUndefined();
    });

    it('rejects payload with Date created_at', () => {
        const payload = {
            id: uuidv4(),
            nombre: 'Test flow',
            json_flujo: validJsonFlujo,
            status: 1,
            created_at: new Date(),
            created_by: uuidv4(),
        };

        const result = createSchema.validate(payload, { abortEarly: false });
        expect(result.error).toBeDefined();
        expect(result.error.details.map((d) => d.message)).toContain('"created_at" must be a string');
    });

    it('accepts clean frontend payload without id', () => {
        const payload = {
            nombre: 'Test flow',
            json_flujo: validJsonFlujo,
            status: 1,
        };

        const result = createSchema.validate(payload, { abortEarly: false });
        expect(result.error).toBeUndefined();
    });

    it('rejects edges with non-uuid source other than 0', () => {
        const payload = {
            nombre: 'Test flow',
            json_flujo: {
                nodes: [],
                edges: [{ id: 'edge-1', source: 'invalid', target: uuidv4() }],
            },
            status: 1,
        };

        const result = createSchema.validate(payload, { abortEarly: false });
        expect(result.error).toBeDefined();
    });
});
