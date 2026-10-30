import { get } from '../_shared/http.js';
import { loadIds, pickRandom } from '../_shared/data-pool.js';
import { withWarmup, DEFAULT_OPTIONS } from '../_shared/thresholds.js';

const caseIds = loadIds('cases');

export const options = withWarmup(DEFAULT_OPTIONS);

export default function () {
    const id = pickRandom(caseIds);
    get(`/case-available-states/${id}`);
}
