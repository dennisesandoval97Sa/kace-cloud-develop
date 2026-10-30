import { post } from '../_shared/http.js';
import { withWarmup, DEFAULT_OPTIONS } from '../_shared/thresholds.js';

export const options = withWarmup(DEFAULT_OPTIONS);

const SEARCH_BODY = {
    filter: [
        {
            field: 'description',
            operator: 'like',
            value: 'description example',
            type: 'AND',
        },
        {
            field: 'description',
            operator: 'like',
            value: 'description example',
            type: 'AND',
        },
    ],
    limit: 10,
    offset: 0,
};

export default function () {
    post('/case-attachments/search', SEARCH_BODY);
}
