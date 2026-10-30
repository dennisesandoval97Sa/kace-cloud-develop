import { post } from '../_shared/http.js';
import { withWarmup, DEFAULT_OPTIONS } from '../_shared/thresholds.js';

export const options = withWarmup(DEFAULT_OPTIONS);

const SEARCH_BODY = {
    filter: [
        {
            field: 'name',
            operator: 'like',
            value: 'example name',
            type: 'AND',
        },
        {
            field: 'name',
            operator: 'like',
            value: 'example name',
            type: 'AND',
        },
    ],
    limit: 10,
    offset: 0,
};

export default function () {
    post('/one_script/search', SEARCH_BODY);
}
