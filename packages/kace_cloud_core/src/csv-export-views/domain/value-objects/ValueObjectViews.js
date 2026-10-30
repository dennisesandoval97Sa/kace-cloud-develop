import { Guards, ValidationFailError, ValueObject } from '../../../shared/index.js';

export class ValueObjectViews extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, value);

        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        }
        if (!value && nullable) {
            return;
        }

        Guards.arrayType(this);
        this.#ensureViewsAreValid();
    }

    #ensureViewsAreValid() {
        const uniqueViews = new Set();

        this.value.forEach((view, index) => {
            if (!/^\w+$/.test(view)) {
                throw new ValidationFailError(
                    `(${view}) must be a non-empty string representing a valid view.`,
                    `${this.field}[${index}]`
                );
            }

            if (uniqueViews.has(view)) {
                throw new ValidationFailError(
                    `(${view}) is already present in the array. Values cannot be duplicated.`,
                    `${this.field}[${index}]`
                );
            }

            uniqueViews.add(view);
        });
    }
}
