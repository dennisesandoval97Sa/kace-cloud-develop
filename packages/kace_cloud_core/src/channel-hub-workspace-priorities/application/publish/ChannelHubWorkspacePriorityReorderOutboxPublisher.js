import { ValueObjectUuid } from '../../../shared/domain/value-object/ValueObjectUuid.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { ChannelHubWorkspacePriorityReorderRequested } from '../../domain/events/ChannelHubWorkspacePriorityReorderRequested.js';

export class ChannelHubWorkspacePriorityReorderOutboxPublisher {
    #operationRepository;
    #eventBus;
    #ownerIdFactory;
    #now;
    #claimLeaseDurationMs;
    #baseRetryDelayMs;
    #maxRetryDelayMs;

    constructor({
        operationRepository,
        eventBus,
        ownerIdFactory = () => ValueObjectUuid.random(),
        now = () => new Date(),
        claimLeaseDurationMs = 30_000,
        baseRetryDelayMs = 1_000,
        maxRetryDelayMs = 60_000,
    }) {
        this.#operationRepository = operationRepository;
        this.#eventBus = eventBus;
        this.#ownerIdFactory = ownerIdFactory;
        this.#now = now;
        this.#claimLeaseDurationMs = claimLeaseDurationMs;
        this.#baseRetryDelayMs = baseRetryDelayMs;
        this.#maxRetryDelayMs = maxRetryDelayMs;
    }

    #retryDelay(attemptCount) {
        return Math.min(this.#baseRetryDelayMs * 2 ** Math.max(0, attemptCount - 1), this.#maxRetryDelayMs);
    }

    async #publishClaimed(publications, ownerId, claimedAt) {
        let published = 0;
        let failed = 0;

        for (const publication of publications) {
            try {
                const event = ChannelHubWorkspacePriorityReorderRequested.fromJson(publication.event);
                await this.#eventBus.publish(event);
                await this.#operationRepository.markPublicationPublished(publication.operationId, {
                    eventId: publication.eventId,
                    ownerId,
                    now: claimedAt,
                });
                published += 1;
            } catch (error) {
                failed += 1;
                const nextAttemptAt = new Date(claimedAt.getTime() + this.#retryDelay(publication.publishAttemptCount));
                await this.#operationRepository.releasePublicationClaim(publication.operationId, {
                    ownerId,
                    nextAttemptAt,
                });
                Helper.logError('ChannelHubWorkspacePriorityReorderOutboxPublisher::publicationFailed', {
                    operationId: publication.operationId,
                    eventId: publication.eventId,
                    attemptCount: publication.publishAttemptCount,
                    errorName: error?.name ?? 'Error',
                });
            }
        }

        return { claimed: publications.length, published, failed };
    }

    async publishOperation(operationId) {
        const ownerId = this.#ownerIdFactory();
        const claimedAt = this.#now();
        const publication = await this.#operationRepository.claimPublication(operationId, {
            ownerId,
            leaseDurationMs: this.#claimLeaseDurationMs,
            now: claimedAt,
        });
        return this.#publishClaimed(publication ? [publication] : [], ownerId, claimedAt);
    }

    async publishDue({ limit = 25 } = {}) {
        const ownerId = this.#ownerIdFactory();
        const claimedAt = this.#now();
        const publications = await this.#operationRepository.claimPendingPublications({
            ownerId,
            leaseDurationMs: this.#claimLeaseDurationMs,
            now: claimedAt,
            limit,
        });
        return this.#publishClaimed(publications, ownerId, claimedAt);
    }
}
