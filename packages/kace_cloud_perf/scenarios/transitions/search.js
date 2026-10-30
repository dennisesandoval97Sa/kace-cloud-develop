import { post } from '../_shared/http.js';
import { withWarmup, DEFAULT_OPTIONS } from '../_shared/thresholds.js';

export const options = withWarmup(DEFAULT_OPTIONS);

const SEARCH_BODY = {
    filter: [
        {
            field: 'transiciones.status',
            operator: 'eq',
            value: 1,
            type: 'AND',
        },
        {
            field: 'transiciones.flujo_id',
            operator: 'eq',
            value: '004342ee-80e0-4206-9bed-8cf3a0d35d7f',
            type: 'AND',
        },
        {
            field: 'transiciones.estado_actual_id',
            operator: 'null',
            value: 'null',
            type: 'AND',
        },
    ],
    limit: 50,
    offset: 0,
};

export default function () {
    post('/transitions/search', SEARCH_BODY);
}
