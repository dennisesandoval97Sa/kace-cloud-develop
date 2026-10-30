import { validate as uuidValidate } from "uuid";

export function UuidValidator (value) {
    return uuidValidate(value);
}
