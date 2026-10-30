import { Helper } from '@kace/core/src/shared/index.js';

const DEFAULT_LARGE_RESULT_THRESHOLD = 100;

// Filter values may contain PII (document numbers, emails), so audit entries keep
// only the filter shape and redact every submitted value.
const redactValues = (input) => {
    if (Array.isArray(input)) return input.map(redactValues);
    if (input && typeof input === 'object') {
        return Object.fromEntries(
            Object.entries(input).map(([key, value]) => [key, key === 'value' ? '[REDACTED]' : redactValues(value)])
        );
    }
    return input;
};

export class SearchAuditLogger {
    constructor({ largeResultThreshold = DEFAULT_LARGE_RESULT_THRESHOLD } = {}) {
        this.largeResultThreshold = largeResultThreshold;
    }

    logAuthorized({ endpointKey, userId, mode }) {
        Helper.logInfo('SEARCH_AUDIT search authorized', {
            audit: 'search',
            auditEvent: 'search_authorized',
            endpointKey,
            userId: userId ?? null,
            mode,
        });
    }

    logDenied({ endpointKey, userId, reason, details }) {
        Helper.logInfo('SEARCH_AUDIT search denied', {
            audit: 'search',
            auditEvent: 'search_denied',
            endpointKey,
            userId: userId ?? null,
            reason,
            details: redactValues(details || {}),
        });
    }

    logExecuted({ endpointKey, userId, resultCount, totalCount }) {
        const effectiveCount = totalCount ?? resultCount ?? 0;
        const isLargeResultSet = effectiveCount >= this.largeResultThreshold;

        Helper.logInfo('SEARCH_AUDIT search executed', {
            audit: 'search',
            auditEvent: 'search_executed',
            endpointKey,
            userId: userId ?? null,
            resultCount: resultCount ?? null,
            totalCount: totalCount ?? null,
            isLargeResultSet,
            largeResultThreshold: this.largeResultThreshold,
        });
    }
}
