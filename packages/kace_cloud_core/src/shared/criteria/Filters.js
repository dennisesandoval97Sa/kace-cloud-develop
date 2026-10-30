import { Filter } from './Filter';

export class Filters {
    /** @type {Array} is initialized in the constructor*/
    #filters;

    constructor(filters) {
        this.#filters = filters;
    }

    get filters() {
        return this.#filters;
    }

    static fromValues(filters, tablename = null) {
        return new Filters(
            filters.map((filter) => {
                if (filter.isBoardUnifiedSqlWhere) {
                    return filter;
                }
                if (filter.groupType && filter.filters) {
                    const filts = filter.filters.map((subFilter) => {
                        if (subFilter.isBoardUnifiedSqlWhere) {
                            return subFilter;
                        }
                        const filterField = subFilter.field;
                        const isQualified = filterField.includes('.');
                        const fullfilterField = isQualified ? filterField : `${tablename}.${filterField}`;
                        subFilter.field = fullfilterField;
                        return Filter.fromValues(subFilter, tablename);
                    });
                    return { ...filter, filters: filts };
                }
                const filterField = filter.field;
                const isQualified = filterField.includes('.');
                const fullfilterField = isQualified ? filterField : `${tablename}.${filterField}`;
                filter.field = fullfilterField;
                return Filter.fromValues(filter, tablename);
            })
        );
    }

    toJson() {
        return this.#filters.map((filter) => filter.toJson());
    }
}
