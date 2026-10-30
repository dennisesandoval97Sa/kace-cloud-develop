import { jest } from '@jest/globals';

jest.unstable_mockModule('@kace/core/src/shared/application/events/EventDeduplicator.js', () => ({
    EventDeduplicator: jest.fn(),
}));
jest.unstable_mockModule('@kace/core/src/shared/infrastructure/events/KnexEventDeduplicationRepository.js', () => ({
    KnexEventDeduplicationRepository: jest.fn(),
}));

const { EventDeduplicator } = await import('@kace/core/src/shared/application/events/EventDeduplicator.js');
const { runWithDeduplication } = await import('../../src/shared/runWithDeduplication.mjs');

describe('runWithDeduplication', () => {
    let mockDeduplicator;
    let userRepository;
    let factories;

    beforeEach(() => {
        mockDeduplicator = {
            isAlreadyProcessed: jest.fn(),
            markAsProcessed: jest.fn().mockResolvedValue(undefined),
        };
        EventDeduplicator.mockImplementation(() => mockDeduplicator);

        userRepository = { connection: { mock: 'knex' } };
        factories = new Map([['kace.core.case.created', jest.fn().mockResolvedValue(undefined)]]);
    });

    it('skips processing when isAlreadyProcessed returns true', async () => {
        mockDeduplicator.isAlreadyProcessed.mockResolvedValue(true);
        const event = { eventId: 'evt-1', eventName: 'kace.core.case.created' };

        await runWithDeduplication(event, userRepository, factories);

        expect(factories.get('kace.core.case.created')).not.toHaveBeenCalled();
        expect(mockDeduplicator.markAsProcessed).not.toHaveBeenCalled();
    });

    it('invokes the factory and marks as processed when not deduped', async () => {
        mockDeduplicator.isAlreadyProcessed.mockResolvedValue(false);
        const event = { eventId: 'evt-1', eventName: 'kace.core.case.created' };

        await runWithDeduplication(event, userRepository, factories);

        expect(factories.get('kace.core.case.created')).toHaveBeenCalledWith({ userRepository }, event);
        expect(mockDeduplicator.markAsProcessed).toHaveBeenCalledWith(event);
    });

    it('throws when eventName is not in factories map', async () => {
        mockDeduplicator.isAlreadyProcessed.mockResolvedValue(false);
        const event = { eventId: 'evt-1', eventName: 'kace.core.unknown' };

        await expect(runWithDeduplication(event, userRepository, factories)).rejects.toThrow(
            /no handler registered for kace.core.unknown/
        );
        expect(mockDeduplicator.markAsProcessed).not.toHaveBeenCalled();
    });

    it('does NOT mark as processed if the handler factory throws', async () => {
        mockDeduplicator.isAlreadyProcessed.mockResolvedValue(false);
        const event = { eventId: 'evt-1', eventName: 'kace.core.case.created' };
        factories.set('kace.core.case.created', jest.fn().mockRejectedValue(new Error('boom')));

        await expect(runWithDeduplication(event, userRepository, factories)).rejects.toThrow('boom');
        expect(mockDeduplicator.markAsProcessed).not.toHaveBeenCalled();
    });

    it('returns { deduped: true } when the event was already processed', async () => {
        mockDeduplicator.isAlreadyProcessed.mockResolvedValue(true);
        const event = { eventId: 'evt-1', eventName: 'kace.core.case.created' };
        const result = await runWithDeduplication(event, userRepository, factories);
        expect(result).toEqual({ deduped: true });
    });

    it('returns { deduped: false } after processing a fresh event', async () => {
        mockDeduplicator.isAlreadyProcessed.mockResolvedValue(false);
        const event = { eventId: 'evt-1', eventName: 'kace.core.case.created' };
        const result = await runWithDeduplication(event, userRepository, factories);
        expect(result).toEqual({ deduped: false });
    });
});
