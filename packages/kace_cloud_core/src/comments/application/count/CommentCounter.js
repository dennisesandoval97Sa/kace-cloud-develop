import { Criteria } from '../../../shared/criteria/Criteria';
import { CommentsCountResponse } from '../CommentsCountResponse';

export class CommentCounter {
    /** @type {KnexCommentsRepository} is initialized in the constructor */
    #repository;
    constructor(repository) {
        this.#repository = repository;
    }

    async execute({ select, condition, limit, offset, distinct }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(select, condition, limit, offset, distinct, tablename);
        const response = await this.#repository.count(criteria);
        return new CommentsCountResponse(response);
    }
}
