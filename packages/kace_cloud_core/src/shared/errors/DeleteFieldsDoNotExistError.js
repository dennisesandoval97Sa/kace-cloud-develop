import { BaseError } from './BaseError.js';

export class DeleteFieldsDoNotExistError extends BaseError {
    constructor(entity) {
        super(`The fields deleted_at and deleted_by do not exist in the entity: ${entity}`, 500, [
            'deleted_at',
            'deleted_by',
        ]);
    }
}
