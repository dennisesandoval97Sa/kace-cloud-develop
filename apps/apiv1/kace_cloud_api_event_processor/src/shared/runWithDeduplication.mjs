import { EventDeduplicator } from '@kace/core/src/shared/application/events/EventDeduplicator.js';
import { KnexEventDeduplicationRepository } from '@kace/core/src/shared/infrastructure/events/KnexEventDeduplicationRepository.js';

/**
 * Runs the deduplication-protected dispatch of a single domain event.
 *
 * Flow:
 *   1. Check event_deduplication table — skip if already processed
 *   2. Invoke handlerFactories.get(eventName) with { userRepository }
 *      — throw if no factory exists
 *   3. Mark as processed (INSERT row) — only if handler succeeded
 *
 * Errors from the handler propagate up so the caller (createEventLambdaHandler)
 * can add the messageId to batchItemFailures.
 *
 * @param {import('@kace/core/src/shared/domain/events/DomainEvent.js').DomainEvent} domainEvent
 * @param {{connection: unknown}} userRepository
 * @param {Map<string, (deps: {userRepository: object}, event: object) => Promise<void>>} handlerFactories
 * @returns {Promise<{deduped: boolean}>}
 */
export async function runWithDeduplication(domainEvent, userRepository, handlerFactories) {
    const deduplicationRepo = new KnexEventDeduplicationRepository(userRepository.connection);
    const deduplicator = new EventDeduplicator(deduplicationRepo);

    if (await deduplicator.isAlreadyProcessed(domainEvent.eventId)) {
        return { deduped: true };
    }

    const factory = handlerFactories.get(domainEvent.eventName);
    if (!factory) {
        throw new Error(`runWithDeduplication: no handler registered for ${domainEvent.eventName}`);
    }

    await factory({ userRepository }, domainEvent);

    await deduplicator.markAsProcessed(domainEvent);
    return { deduped: false };
}
