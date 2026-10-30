import { faker } from '@faker-js/faker';

const transformers = new Map();

export function registerTransformer(name, fn) {
    transformers.set(name, fn);
}

export function applyTransformer(name, originalValue) {
    const fn = transformers.get(name);
    if (!fn) {
        throw new Error(`unknown transformer: ${name}`);
    }
    return fn(originalValue);
}

registerTransformer('fakeEmail', () => faker.internet.email());
registerTransformer('fakePhone', () => faker.phone.number());
registerTransformer('fakeFirstName', () => faker.person.firstName());
registerTransformer('fakeLastName', () => faker.person.lastName());
registerTransformer('fakeDocumentNumber', () => faker.string.numeric(10));
registerTransformer('loremIpsum', () => faker.lorem.paragraph());
registerTransformer('loremShort', () => faker.lorem.sentence(6));
registerTransformer('redact', () => '[REDACTED]');
registerTransformer('null', () => null);
