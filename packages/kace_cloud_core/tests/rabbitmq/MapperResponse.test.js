import { Mapper } from '../../src/rabbitmq/domain/Mapper.js';
import { MapperResponse } from '../../src/rabbitmq/application/MapperResponse.js';

describe('MapperResponse audit fields', () => {
    it('includes created_at/updated_at from a DB row and excludes by-fields', () => {
        const row = {
            id: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
            name: 'Test mapper',
            rest_flow_id: 'flow-1',
            queue: 'q1',
            rules: [],
            created_at: '2026-07-01T10:00:00Z',
            updated_at: null,
            created_by: 'user-1',
            updated_by: null,
        };
        const { data } = new MapperResponse(new Mapper(row)).toJson();
        expect(data.created_at).toBe('2026-07-01T10:00:00Z');
        expect(data.updated_at).toBeNull();
        expect(data).not.toHaveProperty('created_by');
        expect(data).not.toHaveProperty('updated_by');
    });

    it('defaults audit fields to null when absent', () => {
        const row = {
            id: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
            name: 'Test mapper',
            rest_flow_id: 'flow-1',
            rules: [],
        };
        const { data } = new MapperResponse(new Mapper(row)).toJson();
        expect(data.created_at).toBeNull();
        expect(data.updated_at).toBeNull();
    });
});
