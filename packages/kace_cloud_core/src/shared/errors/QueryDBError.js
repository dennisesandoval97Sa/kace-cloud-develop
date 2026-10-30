import { BaseError } from './BaseError.js';

export class QueryDBError extends BaseError {
    static OperationType = {
        save: 'Transaction failed: error saving data.',
        find: 'Transaction failed: error retrieving data.',
        search: 'Transaction failed: error executing search.',
        update: 'Transaction failed: error updating data.',
        delete: 'Transaction failed: error deleting data.',
        count: 'Transaction failed: error counting records.',
        createTable: 'Transaction failed: error creating table.',
        custom: (message) => message,
    };

    constructor(operationType, customMessage = '') {
        const isKnown = Boolean(operationType) && operationType in QueryDBError.OperationType;

        let message;
        if (isKnown && operationType === 'custom') {
            message = QueryDBError.OperationType.custom(customMessage || 'unspecified error');
        } else if (isKnown) {
            message = QueryDBError.OperationType[operationType];
        } else {
            const label = operationType ? String(operationType) : 'unknown';
            message = customMessage
                ? `Transaction failed [${label}]: ${customMessage}`
                : `Transaction failed [${label}].`;
        }

        super(message, 500);
    }
}
