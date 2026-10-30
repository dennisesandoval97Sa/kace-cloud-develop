import { StatusEnum } from '../../../../src/shared/index.js';

describe('Test Status enum', () => {
    test('Status is a StatusEnum instance', () => {
        const state = StatusEnum.fromValue(StatusEnum.ACTIVE.value);
        expect(state).toBeInstanceOf(StatusEnum);
    });

    test('Status is active', () => {
        const state = StatusEnum.fromValue(StatusEnum.ACTIVE.value);
        expect(state.value).toBe(StatusEnum.ACTIVE.value);
    });

    test('Status is inactive', () => {
        const state = StatusEnum.fromValue(StatusEnum.INACTIVE.value);
        expect(state.value).toBe(StatusEnum.INACTIVE.value);
    });

    test('should return exceptio when invalid status is passed', () => {
        expect(() => StatusEnum.fromValue('INVALID_STATUS')).toThrow('Invalid value: INVALID_STATUS');
    });
});
