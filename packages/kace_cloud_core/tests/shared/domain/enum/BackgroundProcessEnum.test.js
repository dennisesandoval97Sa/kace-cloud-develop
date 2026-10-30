import { BackgroundProcessEnum } from '../../../../src/shared/domain/enum/BackgroundProcessEnum.js';
import { InvalidArgumentError } from '../../../../src/shared/errors/InvalidArgumentError.js';

describe('BackgroundProcessEnum', () => {
    it('reports invalid values as bad requests', () => {
        let error;
        try {
            BackgroundProcessEnum.fromValue('invalid');
        } catch (caughtError) {
            error = caughtError;
        }

        expect(error).toBeInstanceOf(InvalidArgumentError);
        expect(error.statusCode).toBe(400);
    });

    it('reports null values as bad requests', () => {
        let error;
        try {
            new BackgroundProcessEnum('INVALID', null);
        } catch (caughtError) {
            error = caughtError;
        }

        expect(error).toBeInstanceOf(InvalidArgumentError);
        expect(error.statusCode).toBe(400);
    });
});
