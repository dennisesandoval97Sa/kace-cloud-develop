export class SchemaFunctionsService {
    getAll() {
        const data = {
            dates: [
                {
                    name: 'addDays',
                    params: [
                        { name: 'date', type: 'date' },
                        { name: 'n', type: 'number' },
                    ],
                },
                {
                    name: 'addMonths',
                    params: [
                        { name: 'date', type: 'date' },
                        { name: 'n', type: 'number' },
                    ],
                },
                {
                    name: 'addHours',
                    params: [
                        { name: 'date', type: 'date' },
                        { name: 'n', type: 'number' },
                    ],
                },
                {
                    name: 'addMinutes',
                    params: [
                        { name: 'date', type: 'date' },
                        { name: 'n', type: 'number' },
                    ],
                },
                { name: 'startOfMonth', params: [{ name: 'date', type: 'date' }] },
                { name: 'endOfMonth', params: [{ name: 'date', type: 'date' }] },
                {
                    name: 'diffDays',
                    params: [
                        { name: 'a', type: 'date' },
                        { name: 'b', type: 'date' },
                    ],
                },
                {
                    name: 'addYears',
                    params: [
                        { name: 'date', type: 'date' },
                        { name: 'n', type: 'number' },
                    ],
                },
                {
                    name: 'subDays',
                    params: [
                        { name: 'date', type: 'date' },
                        { name: 'n', type: 'number' },
                    ],
                },
                {
                    name: 'subMonths',
                    params: [
                        { name: 'date', type: 'date' },
                        { name: 'n', type: 'number' },
                    ],
                },
                {
                    name: 'subYears',
                    params: [
                        { name: 'date', type: 'date' },
                        { name: 'n', type: 'number' },
                    ],
                },
                {
                    name: 'subHours',
                    params: [
                        { name: 'date', type: 'date' },
                        { name: 'n', type: 'number' },
                    ],
                },
                {
                    name: 'subMinutes',
                    params: [
                        { name: 'date', type: 'date' },
                        { name: 'n', type: 'number' },
                    ],
                },
                {
                    name: 'now',
                    params: [],
                },
            ],

            math: [
                { name: 'sum', params: [{ name: 'values', type: 'number', variadic: true }] },
                {
                    name: 'sub',
                    params: [
                        { name: 'a', type: 'number' },
                        { name: 'b', type: 'number' },
                    ],
                },
                {
                    name: 'mul',
                    params: [
                        { name: 'a', type: 'number' },
                        { name: 'b', type: 'number' },
                    ],
                },
                {
                    name: 'div',
                    params: [
                        { name: 'a', type: 'number' },
                        { name: 'b', type: 'number' },
                    ],
                },
                {
                    name: 'round',
                    params: [
                        { name: 'n', type: 'number' },
                        { name: 'd', type: 'number' },
                    ],
                },
                { name: 'min', params: [{ name: 'values', type: 'number', variadic: true }] },
                { name: 'max', params: [{ name: 'values', type: 'number', variadic: true }] },
            ],

            chains: [
                {
                    name: 'concat',
                    params: [
                        { name: 'cond', type: 'boolean' },
                        { name: 'values', type: 'string', variadic: true },
                    ],
                },
                { name: 'upper', params: [{ name: 's', type: 'string' }] },
                { name: 'lower', params: [{ name: 's', type: 'string' }] },
                { name: 'trim', params: [{ name: 's', type: 'string' }] },
                {
                    name: 'slice',
                    params: [
                        { name: 's', type: 'string' },
                        { name: 'i', type: 'number' },
                        { name: 'j', type: 'number' },
                    ],
                },
            ],

            utilities: [
                { name: 'ref', params: [{ name: 'field', type: 'string' }] },
                {
                    name: 'coalesce',
                    params: [
                        { name: 'a', type: 'any' },
                        { name: 'b', type: 'any' },
                    ],
                },
                {
                    name: 'if',
                    params: [
                        { name: 'cond', type: 'boolean' },
                        { name: 'a', type: 'any' },
                        { name: 'b', type: 'any' },
                    ],
                },
                { name: 'len', params: [{ name: 'x', type: 'string' }] },
            ],

            comparators: [
                {
                    name: 'eq',
                    params: [
                        { name: 'a', type: 'any' },
                        { name: 'b', type: 'any' },
                    ],
                },
                {
                    name: 'ne',
                    params: [
                        { name: 'a', type: 'any' },
                        { name: 'b', type: 'any' },
                    ],
                },
                {
                    name: 'gt',
                    params: [
                        { name: 'a', type: 'number|string' },
                        { name: 'b', type: 'number|string' },
                    ],
                },
                {
                    name: 'gte',
                    params: [
                        { name: 'a', type: 'number|string' },
                        { name: 'b', type: 'number|string' },
                    ],
                },
                {
                    name: 'lt',
                    params: [
                        { name: 'a', type: 'number|string' },
                        { name: 'b', type: 'number|string' },
                    ],
                },
                {
                    name: 'lte',
                    params: [
                        { name: 'a', type: 'number|string' },
                        { name: 'b', type: 'number|string' },
                    ],
                },
                {
                    name: 'and',
                    params: [
                        { name: 'cond', type: 'boolean' },
                        { name: 'values', type: 'number|string', variadic: true },
                    ],
                },
                {
                    name: 'or',
                    params: [
                        { name: 'cond', type: 'boolean' },
                        { name: 'values', type: 'number|string', variadic: true },
                    ],
                },
                {
                    name: 'not',
                    params: [
                        { name: 'cond', type: 'boolean' },
                        { name: 'values', type: 'number|string', variadic: true },
                    ],
                },
            ],
        };

        return { data };
    }
}
