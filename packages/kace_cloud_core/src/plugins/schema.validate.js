export class ValidateSchema {
    static validate(schema, data) {
        const { value, error } = schema.validate(data);
        if (error) {
            this.error = error;
            return false;
        }

        return value;
    }

    static getError() {
        return this.error;
    }
}
