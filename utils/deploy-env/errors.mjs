export class UsageError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UsageError';
    }
}

export class AbortedError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AbortedError';
    }
}

export class CommandError extends Error {
    constructor(message, result) {
        super(message);
        this.name = 'CommandError';
        this.result = result;
    }
}
