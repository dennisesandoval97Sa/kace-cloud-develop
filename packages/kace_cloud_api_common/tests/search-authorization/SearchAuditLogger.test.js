import { jest } from '@jest/globals';
import { Helper } from '@kace/core/src/shared/index.js';
import { SearchAuditLogger } from '../../src/search-authorization/SearchAuditLogger.js';

describe('SearchAuditLogger', () => {
    let logInfoSpy;

    beforeEach(() => {
        logInfoSpy = jest.spyOn(Helper, 'logInfo').mockImplementation(() => {});
    });

    afterEach(() => {
        logInfoSpy.mockRestore();
    });

    it('logs authorized searches with endpoint, user, and mode', () => {
        new SearchAuditLogger().logAuthorized({
            endpointKey: 'clients.search',
            userId: 'user-1',
            mode: 'restricted',
        });

        expect(logInfoSpy).toHaveBeenCalledWith('SEARCH_AUDIT search authorized', {
            audit: 'search',
            auditEvent: 'search_authorized',
            endpointKey: 'clients.search',
            userId: 'user-1',
            mode: 'restricted',
        });
    });

    it('logs denied searches and redacts submitted filter values', () => {
        new SearchAuditLogger().logDenied({
            endpointKey: 'clients.search',
            userId: 'user-1',
            reason: 'disallowed_filters',
            details: {
                disallowedFilters: [{ field: 'documento', operator: 'eq', value: '123456789', type: 'AND' }],
            },
        });

        expect(logInfoSpy).toHaveBeenCalledWith('SEARCH_AUDIT search denied', {
            audit: 'search',
            auditEvent: 'search_denied',
            endpointKey: 'clients.search',
            userId: 'user-1',
            reason: 'disallowed_filters',
            details: {
                disallowedFilters: [{ field: 'documento', operator: 'eq', value: '[REDACTED]', type: 'AND' }],
            },
        });
    });

    it('redacts values inside nested filter groups', () => {
        new SearchAuditLogger().logDenied({
            endpointKey: 'clients.search',
            userId: 'user-1',
            reason: 'missing_required_filter_groups',
            details: {
                missingRequiredFilterGroups: [
                    {
                        name: 'client_specific_search_criteria',
                        filters: [{ field: 'email', operator: 'ilike', value: 'someone@example.com' }],
                    },
                ],
            },
        });

        const [, metadata] = logInfoSpy.mock.calls[0];
        expect(metadata.details.missingRequiredFilterGroups[0].filters[0].value).toBe('[REDACTED]');
    });

    it('logs executed searches without flagging small result sets', () => {
        new SearchAuditLogger().logExecuted({
            endpointKey: 'clients.search',
            userId: 'user-1',
            resultCount: 3,
            totalCount: 3,
        });

        expect(logInfoSpy).toHaveBeenCalledWith('SEARCH_AUDIT search executed', {
            audit: 'search',
            auditEvent: 'search_executed',
            endpointKey: 'clients.search',
            userId: 'user-1',
            resultCount: 3,
            totalCount: 3,
            isLargeResultSet: false,
            largeResultThreshold: 100,
        });
    });

    it('flags unusually large result sets using the total count', () => {
        new SearchAuditLogger().logExecuted({
            endpointKey: 'clients.search',
            userId: 'user-1',
            resultCount: 20,
            totalCount: 5000,
        });

        const [, metadata] = logInfoSpy.mock.calls[0];
        expect(metadata.isLargeResultSet).toBe(true);
    });

    it('honors a custom large-result threshold', () => {
        new SearchAuditLogger({ largeResultThreshold: 10 }).logExecuted({
            endpointKey: 'clients.search',
            userId: 'user-1',
            resultCount: 10,
            totalCount: 10,
        });

        const [, metadata] = logInfoSpy.mock.calls[0];
        expect(metadata.isLargeResultSet).toBe(true);
        expect(metadata.largeResultThreshold).toBe(10);
    });

    it('falls back to the result count when no total count is provided', () => {
        new SearchAuditLogger().logExecuted({
            endpointKey: 'clients.search',
            userId: 'user-1',
            resultCount: 150,
        });

        const [, metadata] = logInfoSpy.mock.calls[0];
        expect(metadata.isLargeResultSet).toBe(true);
        expect(metadata.totalCount).toBeNull();
    });

    it('logs a null user id when none is available', () => {
        new SearchAuditLogger().logAuthorized({ endpointKey: 'clients.search', mode: 'advanced' });

        const [, metadata] = logInfoSpy.mock.calls[0];
        expect(metadata.userId).toBeNull();
    });
});
