import { post } from '../_shared/http.js';
import { withWarmup, DEFAULT_OPTIONS } from '../_shared/thresholds.js';

export const options = withWarmup(DEFAULT_OPTIONS);

const SEARCH_BODY = {
    filter: [
        {
            field: 'nombre',
            operator: 'like',
            value: 'example name',
            type: 'AND',
        },
        {
            field: 'nombre',
            operator: 'like',
            value: 'example name',
            type: 'AND',
        },
    ],
    limit: 10,
    offset: 0,
};

export default function () {
    post('/states/search', SEARCH_BODY);
}
