import { post } from '../_shared/http.js';
import { withWarmup, DEFAULT_OPTIONS } from '../_shared/thresholds.js';

export const options = withWarmup(DEFAULT_OPTIONS);

const SEARCH_BODY = {
    filter: [
        {
            field: 'data',
            operator: 'jsonContains',
            value: '{"literal":"Paises", "grupo":"030ce82b-ec47-4645-b969-28da30f78c2c"}',
            type: 'AND',
        },
    ],
    limit: 0,
    offset: 0,
};

export default function () {
    post('/auxiliaries/{entidad}/search', SEARCH_BODY);
}
