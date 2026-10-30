import { post } from '../_shared/http.js';
import { withWarmup, DEFAULT_OPTIONS } from '../_shared/thresholds.js';

export const options = withWarmup(DEFAULT_OPTIONS);

const SEARCH_BODY = {
    filter: [],
    limit: 10,
    offset: 0,
};

export default function () {
    post('/schemas/search', SEARCH_BODY);
}
