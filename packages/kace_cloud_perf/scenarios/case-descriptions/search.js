import { post } from '../_shared/http.js';
import { withWarmup, DEFAULT_OPTIONS } from '../_shared/thresholds.js';

export const options = withWarmup(DEFAULT_OPTIONS);

const SEARCH_BODY = {
    filter: [
        {
            field: 'descripcion',
            operator: 'like',
            value: 'description example',
            type: 'AND',
        },
        {
            field: 'descripcion',
            operator: 'like',
            value: 'description example',
            type: 'AND',
        },
    ],
    limit: 10,
    offset: 0,
};

export default function () {
    post('/case-descriptions/search', SEARCH_BODY);
}
