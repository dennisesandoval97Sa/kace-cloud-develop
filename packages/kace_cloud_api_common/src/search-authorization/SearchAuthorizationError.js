export class SearchAuthorizationError extends Error {
    constructor(endpointKey, reason, details = {}) {
        super('Advanced Search query is not allowed for this role.');
        this.name = 'SearchAuthorizationError';
        this.statusCode = 403;
        this.endpointKey = endpointKey;
        this.reason = reason;
        this.details = details;
    }
}
