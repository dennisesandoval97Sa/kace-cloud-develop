import { SharedArray } from 'k6/data';

export function loadIds(table) {
    return new SharedArray(`${table}-ids`, () => {
        return JSON.parse(open(`../../data/data-pool/${table}.local.json`));
    });
}

export function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
