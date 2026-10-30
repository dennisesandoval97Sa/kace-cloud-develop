import { XSSDictionary } from '../../../../src/shared/domain/security/XSSDictionary';
import { XSSGuard } from '../../../../src/shared/domain/guards/XSSGuard';
import { InvalidArgumentError } from '../../../../src/shared/errors/InvalidArgumentError';

describe('XSSDictionary', () => {
    it('should detect XSS patterns in the input string', () => {
        const inputs = ["<script>alert('XSS');</script>", "javascript:alert('XSS')", "onerror=alert('XSS')"];

        const expectedPatterns = ['script', 'javascript', 'onerror'];

        inputs.forEach((input, i) => {
            const [result] = XSSDictionary.findXSSPatterns(input);
            expect(result).toEqual(expectedPatterns[i]);
        });
    });

    it('should return empty for non-string input', () => {
        const inputs = [null, undefined, 123, {}, []];

        inputs.forEach((input) => {
            const result = XSSDictionary.findXSSPatterns(input);
            expect(result).toEqual([]);
        });
    });

    it('should not detect XSS patterns in safe input', () => {
        const safeInputs = ['Hello, world!', 'Just a regular text.', 'No harmful content here.'];

        safeInputs.forEach((input) => {
            const result = XSSDictionary.findXSSPatterns(input);
            expect(result).toEqual([]);
        });
    });
});

describe('sanitize', () => {
    it('should escape special characters in the input string', () => {
        const input = '<script>alert("XSS")</script>';
        const sanitized = XSSDictionary.sanitize(input);
        const expected = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;';
        expect(sanitized).toBe(expected);
    });

    it('should handle input with no special characters', () => {
        const input = 'No special characters';
        const sanitized = XSSDictionary.sanitize(input);
        expect(sanitized).toBe(input);
    });
});

describe('XSSGuard', () => {
    test('should include detected XSS patterns in the error message', () => {
        const input = "<script>alert('XSS');</script>";
        expect(() => XSSGuard.validate(input)).toThrow(InvalidArgumentError);
    });

    test('should not flag safe inputs', () => {
        const safeInputs = ['Hello, world!', 'Welcome to our website.', 'This is a test string without XSS patterns.'];

        safeInputs.forEach((input) => {
            expect(() => XSSGuard.validate(input)).not.toThrow(InvalidArgumentError);
        });
    });

    test('should handle empty and non-string inputs gracefully', () => {
        const inputs = [null, undefined, 123, {}, []];

        inputs.forEach((input) => {
            expect(() => XSSGuard.validate(input)).not.toThrow();
        });
    });
});
