export class ValueObjectString {
    constructor(name, value, nullable = false) {
        this.name = name;
        if (value === undefined || value === null) {
            if (nullable) {
                this.value = null;
                return;
            }
            throw new Error(`${name} is required`);
        }
        if (typeof value !== 'string') throw new Error(`${name} must be a string`);
        this.value = value;
    }
}
