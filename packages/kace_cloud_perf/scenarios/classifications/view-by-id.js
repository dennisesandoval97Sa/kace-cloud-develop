import { get } from '../_shared/http.js';
import { withWarmup, DEFAULT_OPTIONS } from '../_shared/thresholds.js';
import { loadIds, pickRandom } from '../_shared/data-pool.js';

export const options = withWarmup(DEFAULT_OPTIONS);

const IDS = loadIds('clasificaciones');

export default function () {
    const id = pickRandom(IDS);
    get('/classifications/{id}'.replace('{id}', id));
}
