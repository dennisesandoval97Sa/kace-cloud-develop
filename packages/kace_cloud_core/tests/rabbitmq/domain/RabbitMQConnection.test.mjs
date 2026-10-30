import { AdapterSettings } from '../../../src/rabbitmq/domain/AdapterSettings.js';
import { CustomError } from '../../../src/shared/index.js';

describe('AdapterSettings Domain', () => {
    test('create should throw when dto missing', () => {
        expect(() => AdapterSettings.create()).toThrow(CustomError);
    });

    test('create should throw when host missing', () => {
        expect(() => AdapterSettings.create({ queue: 'q1' })).toThrow(CustomError);
    });

    test('create should throw when queue missing', () => {
        expect(() => AdapterSettings.create({ host: 'amqp://localhost' })).toThrow(CustomError);
    });

    test('create should succeed with required fields', () => {
        const dto = { id: '1', name: 'conn', host: 'amqp://localhost', queue: 'q1' };
        const conn = AdapterSettings.create(dto);
        expect(conn).toBeInstanceOf(AdapterSettings);
        expect(conn.host).toBe(dto.host);
        expect(conn.queue).toBe(dto.queue);
    });
});
