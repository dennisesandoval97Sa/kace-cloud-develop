export class SearchValidation {
    constructor(select, condition, limit, offset, distinct) {
        this.select = select;
        this.condition = condition;
        this.limit = limit;
        this.offset = offset;
        this.distinct = distinct;
    }

    static validate(data) {
        const { select, condition, relationship, limit, offset, distinct } = data;

        if (condition.length === undefined) {
            return ['condition must be array', undefined];
        }

        if (!select || !condition || typeof condition !== 'object') {
            return ['Invalid params for search', undefined];
        }

        return [undefined, new SearchValidation(select, condition, relationship, limit, offset, distinct)];
    }
}
