import { post } from '../_shared/http.js';
import { withWarmup, DEFAULT_OPTIONS } from '../_shared/thresholds.js';

export const options = withWarmup(DEFAULT_OPTIONS);

const SEARCH_BODY = {
    filter: [
        {
            field: 'description',
            operator: 'like',
            value: 'example description',
            type: 'AND',
        },
        {
            field: 'description',
            operator: 'like',
            value: 'example description',
            type: 'AND',
        },
    ],
    limit: 10,
    offset: 0,
};

export default function () {
    post('/global-configuration/search', SEARCH_BODY);
}
