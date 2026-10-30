import { SQLInjectionGuard } from '../src/shared/domain/guards/SQLInjectionGuard.js';
import { XSSGuard } from '../src/shared/domain/guards/XSSGuard.js';

export default class TestHelper {
    static generateSafeValue(fn) {
        if (typeof fn !== 'function') {
            throw new Error('generator must be a function');
        }

        let output = fn();
        while (
            SQLInjectionGuard.validate(output, 'test', false) === false ||
            XSSGuard.validate(output, false) === false
        ) {
            output = fn();
        }

        return output;
    }
}
