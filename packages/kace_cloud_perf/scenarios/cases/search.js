import { post } from '../_shared/http.js';
import { withWarmup, DEFAULT_OPTIONS } from '../_shared/thresholds.js';

export const options = withWarmup(DEFAULT_OPTIONS);

const SEARCH_BODY = {
    filter: [
        {
            field: 'deleted_at',
            operator: 'null',
            value: 'null',
            type: 'AND',
        },
    ],
    relationship: null,
    order: {
        field: 'created_at',
        direction: 'desc',
    },
    limit: 10,
    offset: 0,
};

export default function () {
    post('/cases/view/search', SEARCH_BODY);
}
