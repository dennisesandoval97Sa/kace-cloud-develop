import { Guards, ValueObject } from '../../index.js';

export class ValueObjectPath extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, value, nullable);

        if (!value && nullable) {
            return;
        } else {
            Guards.stringMaxLength(this, 1000);
            Guards.stringPattern(
                this,
                /(?:https?:\/\/(?:www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)|(?:\/[a-zA-Z0-9._%-]+(?:\/[a-zA-Z0-9._%-]*)*)/g, // SONAR-EXC: The guards are responsible for validating the value, avoiding intense CPU usage
                `${this.field}: Invalid value for object path`
            );
        }
    }
}
