export class InvalidTargetTableError extends Error {
    constructor(table) {
        super(`Target table "${table}" is not valid.`);
        this.name = 'InvalidTargetTableError';
    }
}
