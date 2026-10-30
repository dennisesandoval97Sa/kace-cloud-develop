import SchemaBuilder from '../src/SchemaBuilder';

const addressStructure = {
    address: {
        type: 'object',
        required: true,
        data_structure: {
            street: { type: 'string', required: true },
            city: { type: 'string', required: true },
        },
    },
    notes: { type: 'string', required: false, empty: true },
};

const validate = (ds, data) => SchemaBuilder.build(ds).validate(data, { abortEarly: false, allowUnknown: true });

describe('SchemaBuilder.dropUntouchedNestedErrors', () => {
    it('drops required errors under an object key absent from the patch', () => {
        const { error } = validate(addressStructure, { address: { street: 'only-street' }, notes: 'ok' });
        expect(error).toBeDefined();
        const details = SchemaBuilder.dropUntouchedNestedErrors(error.details, addressStructure, { notes: 'ok' });
        expect(details).toEqual([]);
    });

    it('drops required errors under an array key absent from the patch', () => {
        const ds = {
            tags: {
                type: 'array',
                required: true,
                data_structure: {
                    label: { type: 'string', required: true },
                },
            },
            notes: { type: 'string', required: false, empty: true },
        };
        const { error } = validate(ds, { notes: 'ok' });
        expect(error).toBeDefined();
        const details = SchemaBuilder.dropUntouchedNestedErrors(error.details, ds, { notes: 'ok' });
        expect(details).toEqual([]);
    });

    it('keeps required errors when the parent object is present in the patch', () => {
        const { error } = validate(addressStructure, { address: { street: 'only-street' } });
        expect(error).toBeDefined();
        const details = SchemaBuilder.dropUntouchedNestedErrors(error.details, addressStructure, {
            address: { street: 'only-street' },
        });
        expect(details.length).toBeGreaterThan(0);
        expect(details.some((d) => (d.path ?? []).includes('city'))).toBe(true);
    });

    it('drops errors under an inner object that is absent from a touched parent', () => {
        const ds = {
            formA: {
                type: 'object',
                required: true,
                data_structure: {
                    a: { type: 'number', required: true },
                    geo: {
                        type: 'object',
                        required: true,
                        data_structure: {
                            lat: { type: 'number', required: true },
                        },
                    },
                },
            },
        };
        const { error } = validate(ds, { formA: { a: 1 } });
        const details = SchemaBuilder.dropUntouchedNestedErrors(error?.details ?? [], ds, { formA: { a: 1 } });
        expect(details.some((d) => (d.path ?? []).includes('geo'))).toBe(false);
    });

    it('keeps array.min when the patch sends an empty required array', () => {
        const ds = {
            tags: {
                type: 'array',
                required: true,
                data_structure: {
                    label: { type: 'string', required: true },
                },
            },
        };
        const { error } = validate(ds, { tags: [] });
        expect(error).toBeDefined();
        const details = SchemaBuilder.dropUntouchedNestedErrors(error.details, ds, { tags: [] });
        expect(details.length).toBeGreaterThan(0);
    });

    it('returns details unchanged when dataStructure is null', () => {
        const details = [{ path: ['address', 'city'], message: 'required', type: 'any.required' }];
        expect(SchemaBuilder.dropUntouchedNestedErrors(details, null, {})).toEqual(details);
    });

    it('does not grow BUILD_CACHE when only the patch shape changes', () => {
        SchemaBuilder.clearBuildCache();
        const forms = ['formA', 'formB', 'formC'];
        const nested = ['geo', 'docs', 'fotos'];
        const ds = Object.fromEntries(
            forms.map((form) => [
                form,
                {
                    type: 'object',
                    required: false,
                    data_structure: Object.fromEntries(
                        nested.map((key) => [key, { type: 'string', required: false, empty: true }])
                    ),
                },
            ])
        );
        let shapes = 0;
        for (const form of forms) {
            for (let mask = 0; mask < 8; mask += 1) {
                const inner = {};
                nested.forEach((key, index) => {
                    if (mask & (1 << index)) {
                        inner[key] = 'x';
                    }
                });
                SchemaBuilder.build(ds);
                SchemaBuilder.dropUntouchedNestedErrors([], ds, { [form]: inner });
                shapes += 1;
            }
        }
        expect(shapes).toBe(24);
        expect(SchemaBuilder.getBuildCacheSize()).toBe(1);
    });
});

const formAItemsStructure = {
    formA: {
        type: 'object',
        required: true,
        data_structure: {
            a: { type: 'number', required: true },
            items: {
                type: 'array',
                required: false,
                data_structure: {
                    x: { type: 'number', required: true },
                },
            },
            legacy: { type: 'number', required: false },
        },
    },
    formB: {
        type: 'object',
        required: false,
        data_structure: {
            z: { type: 'number', required: true },
        },
    },
    notes: { type: 'string', required: false, empty: true },
};

const filter = (merged, patch, persisted, shouldOverrideArray = false) => {
    const { error } = validate(formAItemsStructure, merged);
    return SchemaBuilder.dropUntouchedNestedErrors(
        error?.details ?? [],
        formAItemsStructure,
        patch,
        persisted,
        shouldOverrideArray
    );
};

describe('dropUntouchedNestedErrors — evidencia A–D y tipos distintos de any.required', () => {
    it('A: keep number.base on a scalar inside a touched object', () => {
        const persisted = { formA: { a: 1 } };
        const patch = { formA: { a: 'nope' } };
        const details = filter({ formA: { a: 'nope' } }, patch, persisted);
        expect(details.some((d) => d.type === 'number.base' && (d.path ?? []).join('.') === 'formA.a')).toBe(true);
    });

    it('B: drop number.base under an object key absent from the patch', () => {
        const persisted = { formA: { a: 1, legacy: 'abc' }, formB: { z: 1 } };
        const patch = { notes: 'x' };
        const details = filter({ ...persisted, notes: 'x' }, patch, persisted);
        expect(details.some((d) => (d.path ?? []).includes('legacy'))).toBe(false);
        expect(details.some((d) => (d.path ?? []).includes('formA'))).toBe(false);
    });

    it('C: drop number.base on a persisted array item when the array key is absent', () => {
        const persisted = { formA: { a: 1, items: [{ x: 'abc' }] } };
        const patch = { formA: { a: 2 } };
        const details = filter({ formA: { a: 2, items: [{ x: 'abc' }] } }, patch, persisted);
        expect(details.some((d) => (d.path ?? []).join('.') === 'formA.items.0.x')).toBe(false);
    });

    it('D: drop number.base on a preexisting array index when the patch only appends', () => {
        const persisted = { formA: { a: 1, items: [{ x: 'abc' }] } };
        const patch = { formA: { items: [{ x: 5 }] } };
        const merged = { formA: { a: 1, items: [{ x: 'abc' }, { x: 5 }] } };
        const details = filter(merged, patch, persisted, false);
        expect(details.some((d) => (d.path ?? []).join('.') === 'formA.items.0.x')).toBe(false);
    });

    it('keeps number.base on a newly appended array item', () => {
        const persisted = { formA: { a: 1, items: [{ x: 1 }] } };
        const patch = { formA: { items: [{ x: 'bad' }] } };
        const merged = { formA: { a: 1, items: [{ x: 1 }, { x: 'bad' }] } };
        const details = filter(merged, patch, persisted, false);
        expect(details.some((d) => (d.path ?? []).join('.') === 'formA.items.1.x')).toBe(true);
    });

    it('keeps array-item errors for the replaced array when shouldOverrideArray is true', () => {
        const persisted = { formA: { a: 1, items: [{ x: 1 }] } };
        const patch = { formA: { items: [{ x: 'bad' }] } };
        const details = filter({ formA: { a: 1, items: [{ x: 'bad' }] } }, patch, persisted, true);
        expect(details.some((d) => (d.path ?? []).join('.') === 'formA.items.0.x')).toBe(true);
    });
});
