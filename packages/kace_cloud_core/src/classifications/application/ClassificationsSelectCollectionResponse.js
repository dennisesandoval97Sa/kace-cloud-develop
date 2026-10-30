import { buildClassificationLabel } from '../domain/classificationLabel.js';

export class ClassificationsSelectCollectionResponse {
    #collection;
    #count;

    constructor(collection, count) {
        this.#collection = collection;
        this.#count = count;
    }

    static #id(row) {
        const v = row?.id;
        if (typeof v === 'string') return v.trim();
        if (v && typeof v === 'object' && 'value' in v) return String(v.value ?? '').trim();
        return '';
    }

    toJson() {
        return {
            data: {
                items: this.#collection.map((row) => ({
                    value: ClassificationsSelectCollectionResponse.#id(row),
                    label: buildClassificationLabel(row),
                })),
            },
            metadata: { count: this.#count },
        };
    }
}
