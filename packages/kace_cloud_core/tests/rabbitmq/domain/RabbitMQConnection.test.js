import { RabbitMQConnection } from '../../../src/rabbitmq/domain/RabbitMQConnection.js';

describe('RabbitMQConnection', () => {
    describe('constructor defaults', () => {
        it('applies the documented defaults when optional fields are omitted', () => {
            const connection = new RabbitMQConnection({ id: '1', name: 'conn', host: 'broker', queue: 'q1' });

            expect(connection.port).toBe(5672);
            expect(connection.vhost).toBeNull();
            expect(connection.exchange).toBeNull();
            expect(connection.username).toBeNull();
            expect(connection.password).toBeNull();
        });

        it('keeps every explicit value instead of falling back to a default', () => {
            const connection = new RabbitMQConnection({
                id: '1',
                name: 'conn',
                host: 'broker',
                port: 5673,
                queue: 'q1',
                vhost: '/tenant',
                exchange: 'ex1',
                username: 'user1',
                password: 'pass1',
            });

            expect(connection.port).toBe(5673);
            expect(connection.vhost).toBe('/tenant');
            expect(connection.exchange).toBe('ex1');
            expect(connection.username).toBe('user1');
            expect(connection.password).toBe('pass1');
        });
    });

    describe('create()', () => {
        it('builds a RabbitMQConnection when dto, host and queue are all present', () => {
            const connection = RabbitMQConnection.create({ id: '1', name: 'conn', host: 'broker', queue: 'q1' });

            expect(connection).toBeInstanceOf(RabbitMQConnection);
            expect(connection.host).toBe('broker');
            expect(connection.queue).toBe('q1');
        });

        it('throws when dto is missing entirely', () => {
            expect(() => RabbitMQConnection.create(undefined)).toThrow('RabbitMQConnection invalid: dto is required');
        });

        it('throws when host is missing', () => {
            expect(() => RabbitMQConnection.create({ queue: 'q1' })).toThrow(
                'RabbitMQConnection invalid: host is required'
            );
        });

        it('throws when queue is missing', () => {
            expect(() => RabbitMQConnection.create({ host: 'broker' })).toThrow(
                'RabbitMQConnection invalid: queue is required'
            );
        });
    });
});
