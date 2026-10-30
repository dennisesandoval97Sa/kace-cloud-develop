import { AdapterSettings } from '../../src/rabbitmq/domain/AdapterSettings.js';
import { AdapterResponse } from '../../src/rabbitmq/application/AdapterResponse.js';

describe('AdapterResponse audit fields', () => {
    it('includes created_at/updated_at from a DB row and excludes by-fields', () => {
        const row = {
            id: 'd9d6ae18-6b42-4233-877d-c159bba5da0a',
            name: 'Test adapter',
            host: 'google.com',
            port: 5672,
            queue: '1213',
            vhost: '127.0.1.164',
            created_at: '2026-07-01T10:00:00Z',
            updated_at: null,
            created_by: 'user-1',
            updated_by: null,
            password_encryption_migrated: true,
        };
        const { data } = new AdapterResponse(new AdapterSettings(row)).toJson();
        expect(data.created_at).toBe('2026-07-01T10:00:00Z');
        expect(data.updated_at).toBeNull();
        expect(data).not.toHaveProperty('created_by');
        expect(data).not.toHaveProperty('updated_by');
    });

    it('defaults audit fields to null when absent', () => {
        const row = {
            id: 'd9d6ae18-6b42-4233-877d-c159bba5da0a',
            name: 'Test adapter',
            host: 'google.com',
            queue: '1213',
            password_encryption_migrated: true,
        };
        const { data } = new AdapterResponse(new AdapterSettings(row)).toJson();
        expect(data.created_at).toBeNull();
        expect(data.updated_at).toBeNull();
    });
});
