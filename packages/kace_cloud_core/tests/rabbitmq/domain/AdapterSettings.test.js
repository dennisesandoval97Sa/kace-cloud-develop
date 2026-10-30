import { v4 as uuidv4 } from 'uuid';
import { AdapterSettings } from '../../../src/rabbitmq/domain/AdapterSettings.js';

describe('AdapterSettings', () => {
    describe('constructor', () => {
        it('leaves id as null when id is explicitly null (not just when omitted)', () => {
            const adapter = new AdapterSettings({ id: null, name: 'Adapter', host: 'broker', queue: 'q1' });

            expect(adapter.id).toBeNull();
        });

        it('wraps a truthy exchange in a ValueObjectString instead of leaving it null', () => {
            const adapter = new AdapterSettings({
                id: uuidv4(),
                name: 'Adapter',
                host: 'broker',
                queue: 'q1',
                exchange: 'my-exchange',
            });

            expect(adapter.exchange).toBe('my-exchange');
        });

        it('wraps a truthy username in a ValueObjectString instead of leaving it null', () => {
            const adapter = new AdapterSettings({
                id: uuidv4(),
                name: 'Adapter',
                host: 'broker',
                queue: 'q1',
                username: 'rabbit-user',
            });

            expect(adapter.username).toBe('rabbit-user');
        });

        it('keeps exchange/username as null when omitted', () => {
            const adapter = new AdapterSettings({ id: uuidv4(), name: 'Adapter', host: 'broker', queue: 'q1' });

            expect(adapter.exchange).toBeNull();
            expect(adapter.username).toBeNull();
        });
    });

    describe('create()', () => {
        it('throws when dto is missing entirely', () => {
            expect(() => AdapterSettings.create(undefined)).toThrow('AdapterSettings invalid: dto is required');
        });

        it('builds an AdapterSettings from a valid dto', () => {
            const adapter = AdapterSettings.create({ id: uuidv4(), name: 'Adapter', host: 'broker', queue: 'q1' });

            expect(adapter).toBeInstanceOf(AdapterSettings);
            expect(adapter.host).toBe('broker');
        });
    });
});
