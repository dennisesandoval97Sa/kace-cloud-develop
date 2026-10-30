import { NestedValueManager } from '../../../../src/shared/domain/utilities/NestedValueManager';

describe('NestedValueManager', () => {
    const testObj = {
        user: {
            name: 'John',
            address: {
                street: '123 Main St',
                city: 'New York',
                coordinates: [40.7128, -74.006],
            },
            contacts: [
                { type: 'email', value: 'john@example.com' },
                { type: 'phone', value: '+1234567890' },
            ],
        },
        emptyArray: [],
        nullValue: null,
    };

    describe('getValue', () => {
        it('should return undefined for invalid inputs', () => {
            expect(NestedValueManager.getValue(null, 'path')).toBeUndefined();
            expect(NestedValueManager.getValue(undefined, 'path')).toBeUndefined();
            expect(NestedValueManager.getValue({}, null)).toBeUndefined();
            expect(NestedValueManager.getValue({}, 123)).toBeUndefined();
        });

        it('should get top-level properties', () => {
            expect(NestedValueManager.getValue(testObj, 'user')).toEqual(testObj.user);
            expect(NestedValueManager.getValue(testObj, 'emptyArray')).toEqual([]);
        });

        it('should get nested properties with dot notation', () => {
            expect(NestedValueManager.getValue(testObj, 'user.name')).toBe('John');
            expect(NestedValueManager.getValue(testObj, 'user.address.city')).toBe('New York');
        });

        it('should get nested properties with bracket notation', () => {
            expect(NestedValueManager.getValue(testObj, 'user[address][street]')).toBe('123 Main St');
            expect(NestedValueManager.getValue(testObj, 'user.contacts[0].type')).toBe('email');
        });

        it('should get array elements by index', () => {
            expect(NestedValueManager.getValue(testObj, 'user.address.coordinates[0]')).toBe(40.7128);
            expect(NestedValueManager.getValue(testObj, 'user.contacts[1].value')).toBe('+1234567890');
        });

        it('should return undefined for non-existent paths', () => {
            expect(NestedValueManager.getValue(testObj, 'user.age')).toBeUndefined();
            expect(NestedValueManager.getValue(testObj, 'user.address.zip')).toBeUndefined();
            expect(NestedValueManager.getValue(testObj, 'user.contacts[5]')).toBeUndefined();
        });

        it('should return undefined when hitting null/undefined', () => {
            expect(NestedValueManager.getValue(testObj, 'nullValue.property')).toBeUndefined();
            expect(NestedValueManager.getValue(testObj, 'emptyArray[0].property')).toBeUndefined();
        });
    });

    describe('setValue', () => {
        let mutableObj;

        beforeEach(() => {
            mutableObj = JSON.parse(JSON.stringify(testObj));
        });

        it('should return false for invalid inputs', () => {
            expect(NestedValueManager.setValue(null, 'path', 'value')).toBe(false);
            expect(NestedValueManager.setValue(undefined, 'path', 'value')).toBe(false);
            expect(NestedValueManager.setValue({}, null, 'value')).toBe(false);
            expect(NestedValueManager.setValue({}, 123, 'value')).toBe(false);
        });

        it('should set top-level properties', () => {
            expect(NestedValueManager.setValue(mutableObj, 'newProp', 'value')).toBe(true);
            expect(mutableObj.newProp).toBe('value');
        });

        it('should set nested properties with dot notation', () => {
            expect(NestedValueManager.setValue(mutableObj, 'user.name', 'Alice')).toBe(true);
            expect(mutableObj.user.name).toBe('Alice');
        });

        it('should set nested properties with bracket notation', () => {
            expect(NestedValueManager.setValue(mutableObj, 'user[address][city]', 'Boston')).toBe(true);
            expect(mutableObj.user.address.city).toBe('Boston');
        });

        it('should set array elements by index', () => {
            expect(NestedValueManager.setValue(mutableObj, 'user.contacts[0].value', 'alice@example.com')).toBe(true);
            expect(mutableObj.user.contacts[0].value).toBe('alice@example.com');
        });

        it('should create intermediate objects if they dont exist', () => {
            expect(NestedValueManager.setValue(mutableObj, 'new.nested.path', 'value')).toBe(true);
            expect(mutableObj.new.nested.path).toBe('value');
        });

        it('should create intermediate arrays if the next key is numeric', () => {
            const newObj = {};
            expect(NestedValueManager.setValue(newObj, 'new.nested.array[0].path', 'value')).toBe(true);
            expect(Array.isArray(newObj.new.nested.array)).toBe(true);
            expect(newObj.new.nested.array[0].path).toBe('value');
        });

        it('should overwrite existing values', () => {
            expect(NestedValueManager.setValue(mutableObj, 'user.address.coordinates', [1, 2])).toBe(true);
            expect(mutableObj.user.address.coordinates).toEqual([1, 2]);
        });
    });
});
