import { post } from '../_shared/http.js';
import { withWarmup, DEFAULT_OPTIONS } from '../_shared/thresholds.js';

export const options = withWarmup(DEFAULT_OPTIONS);

export default function () {
    post('/cases/view/search', {
        filter: [
            { field: 'cases.parent_id', operator: 'null', value: 'null', type: 'AND' },
            { field: 'deleted_at', operator: 'null', value: 'null', type: 'AND' },
        ],
        relationship: null,
        order: { field: 'created_at', direction: 'desc' },
        limit: 10,
        offset: 0,
    });
}
