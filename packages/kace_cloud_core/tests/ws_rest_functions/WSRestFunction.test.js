import { WSRestFunction } from '../../src/ws_rest_functions/domain/WSRestFunction.js';
import WSRestFunctionMother from './domain/WSRestFunctionMother.js';
import LocalTenantRepository from '../../src/tenant/infrastructure/local/LocalTenantRepository.js';
import { TenantContext } from '../../src/shared/infrastructure/context/TenantContext.js';
import { ValueObjectUuid } from '../../src/shared/domain/value-object/ValueObjectUuid.js';

const tenant = await new LocalTenantRepository().find();

describe('WSRestFunction execute Tests', () => {
    describe('#validatePhone', () => {
        it.each([
            { input: '+14155552671', expected: true, description: 'valid phone number' },
            { input: 1234567890, expected: true, description: 'non-string input' },
        ])('should return $expected for a $description', async ({ input, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'validatePhone';

                // Act
                const result = wsFunction.execute(input);

                // Assert
                expect(result).toBe(expected);
            });
        });

        it.each([
            { input: '12345', description: 'invalid phone number' },
            { input: null, description: 'null input' },
            { input: undefined, description: 'undefined input' },
            { input: '+1(415)555-2671', description: 'phone number with invalid characters' },
        ])('should return false for $description', async ({ input }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'validatePhone';

                // Act
                const result = wsFunction.execute(input);

                // Assert
                expect(result).toBe(false);
            });
        });
    });

    describe('#validateEmail', () => {
        it.each([
            { input: 'user@example.com', description: 'valid email' },
            { input: 'user.name+tag@example.co.uk', description: 'valid email with subdomain and plus tag' },
        ])('should return true for $description', async ({ input }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'validateEmail';

                // Act
                const result = wsFunction.execute(input);

                // Assert
                expect(result).toBe(true);
            });
        });

        it.each([
            { input: 'invalid-email', description: 'missing "@" symbol' },
            { input: 'user@.com', description: 'missing domain name' },
            { input: 'user@example', description: 'missing TLD' },
            { input: 'user@ example.com', description: 'contains space' },
            { input: '', description: 'empty string' },
            { input: null, description: 'null input' },
            { input: undefined, description: 'undefined input' },
            { input: 123456, description: 'non-string input' },
        ])('should return false for $description', async ({ input }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'validateEmail';

                // Act
                const result = wsFunction.execute(input);

                // Assert
                expect(result).toBe(false);
            });
        });
    });

    describe('#formatText', () => {
        it.each([
            { input: 'Hello, World!', expected: 'Hello, World!', description: 'string input' },
            { input: 123, expected: '123', description: 'number input' },
            { input: true, expected: 'true', description: 'boolean true' },
            { input: false, expected: 'false', description: 'boolean false' },
            { input: 0, expected: '0', description: 'zero as number' },
            { input: '', expected: '', description: 'empty string' },
            { input: '   ', expected: '   ', description: 'string with spaces' },
        ])('should return "$expected" for $description', async ({ input, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'formatText';

                // Act
                const result = wsFunction.execute(input);

                // Assert
                expect(result).toBe(expected);
            });
        });

        it.each([
            { input: null, description: 'null input' },
            { input: undefined, description: 'undefined' },
        ])('should return null for $description', async ({ input }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'formatText';

                // Act
                const result = wsFunction.execute(input);

                // Assert
                expect(result).toBeNull();
            });
        });
    });

    describe('#formatNumber', () => {
        it.each([
            { input: 42, expected: 42, description: 'valid number input' },
            { input: '42', expected: 42, description: 'string representing a number' },
            { input: '3.14', expected: 3.14, description: 'string representing a decimal number' },
            { input: '0', expected: 0, description: 'string representing zero' },
            { input: 0, expected: 0, description: 'zero as number' },
            { input: true, expected: 1, description: 'boolean true converted to 1' },
            { input: false, expected: 0, description: 'boolean false converted to 0' },
            { input: '', expected: 0, description: 'empty string converted to 0' },
            { input: '   ', expected: 0, description: 'whitespace-only string converted to 0' },
        ])('should return $expected for $description', async ({ input, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'formatNumber';

                // Act
                const result = wsFunction.execute(input);

                // Assert
                expect(result).toBe(expected);
            });
        });

        it('should return NaN for non-numeric string', async () => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'formatNumber';

                // Act
                const result = wsFunction.execute('abc');

                // Assert
                expect(result).toBeNaN();
            });
        });

        it.each([
            { input: null, description: 'null input' },
            { input: undefined, description: 'undefined input' },
        ])('should throw error for $description', async ({ input }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'formatNumber';

                // Act & Assert
                expect(() => wsFunction.execute(input)).toThrow('Invalid input: must not be null or undefined');
            });
        });
    });

    describe('#increment', () => {
        it.each([
            { value: 5, step: 2, expected: 7, description: 'positive number by positive step' },
            { value: 5, step: -2, expected: 3, description: 'positive number by negative step' },
            { value: -5, step: 3, expected: -2, description: 'negative number by positive step' },
            { value: -5, step: -3, expected: -8, description: 'negative number by negative step' },
            { value: 0, step: 5, expected: 5, description: 'zero by positive step' },
            { value: 0, step: -5, expected: -5, description: 'zero by negative step' },
            { value: 10, step: 0, expected: 10, description: 'with zero step' },
            { value: 3.5, step: 1.5, expected: 5, description: 'floating point numbers' },
            { value: '5', step: 2, expected: 7, description: 'string as value' },
            { value: 5, step: '2', expected: 7, description: 'string as step' },
            { value: 5, step: null, expected: 6, description: 'null as step (defaults to 1)' },
        ])('should return $expected when incrementing $description', async ({ value, step, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'increment';

                // Act
                const result = wsFunction.execute(value, step);

                // Assert
                expect(result).toBe(expected);
            });
        });

        it('should return 11 when incrementing with default step of 1', async () => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'increment';

                // Act
                const result = wsFunction.execute(10);

                // Assert
                expect(result).toBe(11);
            });
        });

        it('should throw error for undefined as value', async () => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'increment';

                // Act & Assert
                expect(() => wsFunction.execute(undefined, 2)).toThrow('The value must be a valid number');
            });
        });
    });

    describe('#isValidUUID', () => {
        it.each([
            { input: '550e8400-e29b-41d4-a716-446655440000', description: 'valid UUID v4' },
            { input: '123e4567-e89b-12d3-a456-426614174000', description: 'valid UUID v4 alternative' },
        ])('should return true for $description', async ({ input }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'isValidUUID';

                // Act
                const result = wsFunction.execute(input);

                // Assert
                expect(result).toBe(true);
            });
        });

        it.each([
            { input: '550e8400e29b41d4a716446655440000', description: 'UUID without hyphens' },
            { input: '550e8400-e29b-41d4-a716-44665544000Z', description: 'UUID with invalid character' },
            { input: 'not-a-uuid', description: 'completely invalid string' },
            { input: '', description: 'empty string' },
            { input: null, description: 'null value' },
            { input: undefined, description: 'undefined value' },
        ])('should return false for $description', async ({ input }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'isValidUUID';

                // Act
                const result = wsFunction.execute(input);

                // Assert
                expect(result).toBe(false);
            });
        });
    });

    describe('#maskText', () => {
        it.each([
            { input: ['HelloWorld', '*', 2, 4], expected: 'He****orld', description: 'default masking' },
            { input: ['SensitiveData', '#', 3, 3], expected: 'Sen#######ata', description: 'custom mask character' },
            { input: ['Short', '*', 1, 1], expected: 'S***t', description: 'short text with minimal masking' },
            { input: ['OneChar', '*', 0, 1], expected: '******r', description: 'only last character visible' },
            { input: ['OnlyStartVisible', '*', 4, 0], expected: 'Only************', description: 'only start visible' },
            { input: ['OnlyEndVisible', '*', 0, 4], expected: '**********ible', description: 'only end visible' },
            {
                input: ['ExactMatch', '*', 5, 5],
                expected: 'ExactMatch',
                description: 'exact match of visible characters',
            },
            { input: ['NoMaskNeeded', '*', 6, 6], expected: 'NoMaskNeeded', description: 'no mask needed' },
        ])('should return "$expected" for $description', async ({ input, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'maskText';

                // Act
                const result = wsFunction.execute(...input);

                // Assert
                expect(result).toBe(expected);
            });
        });

        it.each([
            {
                input: ['TooShort', '*', 5, 4],
                expected: 'Invalid input: Visible characters exceed text length',
                description: 'visible part exceeds text length',
            },
            {
                input: [12345, '*', 2, 2],
                expected: 'Invalid input: must be a string',
                description: 'non-string input',
            },
            {
                input: ['Test', '**', 1, 1],
                expected: 'Invalid input: Mask character must be a single character string',
                description: 'invalid mask character',
            },
            {
                input: ['Test', '*', 'a', 2],
                expected: 'Visible start and end must be numbers',
                description: 'non-numeric visibleStart',
            },
            {
                input: ['Test', '*', 2, 'b'],
                expected: 'Visible start and end must be numbers',
                description: 'non-numeric visibleEnd',
            },
        ])('should throw "$expected" for $description', async ({ input, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'maskText';

                // Act & Assert
                expect(() => wsFunction.execute(...input)).toThrow(expected);
            });
        });
    });

    describe('#concatenate', () => {
        it.each([
            { input: ['Hello', 'World'], expected: 'Hello World', description: 'two words' },
            { input: ['This', 'is', 'a', 'test'], expected: 'This is a test', description: 'multiple words' },
            { input: ['SingleWord'], expected: 'SingleWord', description: 'single word' },
            { input: ['', 'Hello'], expected: ' Hello', description: 'empty string at the start' },
            { input: ['Hello', ''], expected: 'Hello ', description: 'empty string at the end' },
            { input: ['', ''], expected: ' ', description: 'two empty strings' },
            { input: [' spaced', 'test '], expected: ' spaced test ', description: 'strings with spaces' },
            { input: [], expected: '', description: 'empty array' },
        ])('should return "$expected" for $description', async ({ input, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'concatenate';

                // Act
                const result = wsFunction.execute(...input);

                // Assert
                expect(result).toBe(expected);
            });
        });

        it.each([
            { input: ['Hello', 42], description: 'number in inputs' },
            { input: [true, 'World'], description: 'boolean in inputs' },
            { input: [null, 'Text'], description: 'null value in inputs' },
            { input: [undefined, 'Text'], description: 'undefined value in inputs' },
        ])('should throw error for $description', async ({ input }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'concatenate';

                // Act & Assert
                expect(() => wsFunction.execute(...input)).toThrow('All inputs must be strings');
            });
        });
    });

    describe('#concatenateComma', () => {
        it.each([
            { input: ['Hello', 'World'], expected: 'Hello,World', description: 'two strings' },
            { input: ['This', 'is', 'a', 'test'], expected: 'This,is,a,test', description: 'multiple strings' },
            { input: ['SingleWord'], expected: 'SingleWord', description: 'single word' },
            { input: ['', 'Hello'], expected: ',Hello', description: 'empty string at the start' },
            { input: ['Hello', ''], expected: 'Hello,', description: 'empty string at the end' },
            { input: ['', ''], expected: ',', description: 'two empty strings' },
            { input: [], expected: '', description: 'empty array' },
            { input: ['Hello', 42], expected: 'Hello,42', description: 'string and number' },
            { input: [1, 2, 3], expected: '1,2,3', description: 'multiple numbers' },
            { input: ['value', 3.14], expected: 'value,3.14', description: 'string and decimal number' },
            { input: [5, 'America/Bogota'], expected: '5,America/Bogota', description: 'string and timezone' },
        ])('should return "$expected" for $description', async ({ input, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'concatenateComma';

                // Act
                const result = wsFunction.execute(...input);

                // Assert
                expect(result).toBe(expected);
            });
        });

        it.each([
            { input: [true, 'World'], description: 'boolean in inputs' },
            { input: [null, 'Text'], description: 'null value in inputs' },
            { input: [undefined, 'Text'], description: 'undefined value in inputs' },
            { input: [{ key: 'val' }, 'Text'], description: 'object in inputs' },
        ])('should throw error for $description', async ({ input }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'concatenateComma';

                // Act & Assert
                expect(() => wsFunction.execute(...input)).toThrow('All inputs must be strings or numbers');
            });
        });
    });

    describe('#trim', () => {
        it.each([
            { input: '   Hello World   ', expected: 'Hello World', description: 'leading and trailing spaces' },
            { input: 'Hello', expected: 'Hello', description: 'no extra spaces' },
            { input: '   ', expected: '', description: 'only spaces' },
            { input: '  Test   ', expected: 'Test', description: 'spaces at start and end' },
            { input: '\tHello\n', expected: 'Hello', description: 'tab and newline characters' },
        ])('should return "$expected" for $description', async ({ input, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'trim';

                // Act
                const result = wsFunction.execute(input);

                // Assert
                expect(result).toBe(expected);
            });
        });

        it.each([
            { input: 123, description: 'non-string input' },
            { input: null, description: 'null input' },
            { input: undefined, description: 'undefined input' },
        ])('should throw error for $description', async ({ input }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'trim';

                // Act & Assert
                expect(() => wsFunction.execute(input)).toThrow('Invalid input trim: must be a string');
            });
        });
    });

    describe('#formatDate', () => {
        const validDate = '2020-01-15T12:30:45Z';

        it.each([
            { args: [validDate], expected: '2020-01-15', description: 'default format YYYY-MM-DD' },
            { args: [validDate, 'DD-MM-YYYY'], expected: '15-01-2020', description: 'format DD-MM-YYYY' },
            { args: [validDate, 'MM/DD/YYYY'], expected: '01/15/2020', description: 'format MM/DD/YYYY' },
            { args: [validDate, 'YYYY/MM/DD'], expected: '2020/01/15', description: 'format YYYY/MM/DD' },
            {
                args: [validDate, 'YYYY-MM-DD HH:mm:ss'],
                expected: '2020-01-15 12:30:45',
                description: 'format YYYY-MM-DD HH:mm:ss',
            },
            {
                args: [validDate, 'DD/MM/YYYY HH:mm:ss'],
                expected: '15/01/2020 12:30:45',
                description: 'format DD/MM/YYYY HH:mm:ss',
            },
        ])('should return "$expected" for $description', async ({ args, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'formatDate';

                // Act
                const result = wsFunction.execute(...args);

                // Assert
                expect(result).toBe(expected);
            });
        });

        it('should throw for invalid date input', async () => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'formatDate';

                // Act & Assert
                expect(() => wsFunction.execute('invalid-date', 'YYYY-MM-DD')).toThrow('Invalid date format');
            });
        });

        it.each([
            {
                args: ['2024-01-15T12:30:45Z', 'YYYY-MM-DD HH:mm:ss, Invalid/Timezone'],
                expected: '2024-01-15 12:30:45',
                description: 'invalid timezone in comma notation',
            },
            {
                args: ['2024-01-15T12:30:45Z', ', America/Bogota'],
                expected: '2024-01-15',
                description: 'empty format before comma uses default',
            },
            {
                args: ['2024-01-15T12:30:45Z', 'YYYY-MM-DD HH:mm:ss,America/Bogota'],
                expected: '2024-01-15 07:30:45',
                description: 'no space after comma',
            },
            {
                args: ['2024-01-15T12:30:45Z', 'YYYY-MM-DD HH:mm:ss,   America/Bogota   '],
                expected: '2024-01-15 07:30:45',
                description: 'extra spaces around timezone',
            },
            {
                args: ['2024-01-15T12:30:45Z', 'INVALID-FORMAT, America/Bogota'],
                expected: '2024-01-15',
                description: 'invalid format with valid timezone uses default format',
            },
        ])('should return "$expected" for $description', async ({ args, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'formatDate';

                // Act
                const result = wsFunction.execute(...args);

                // Assert
                expect(result).toBe(expected);
            });
        });

        it('should handle timezone conversion with different date formats consistently', async () => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'formatDate';
                const date = '2024-01-15T12:30:45Z';

                // Act
                const bogotaResult = wsFunction.execute(date, 'YYYY-MM-DD HH:mm:ss, America/Bogota');
                const mexicoResult = wsFunction.execute(date, 'DD/MM/YYYY HH:mm:ss, America/Mexico_City');

                // Assert
                expect(bogotaResult).toBe('2024-01-15 07:30:45');
                expect(mexicoResult).toBe('15/01/2024 06:30:45');
            });
        });
    });

    describe('#dateDifference', () => {
        it.each([
            {
                args: ['2023-06-10 18:10:30', '2025-07-07 10:50:10'],
                expected: {
                    byUnit: { year: 2, month: 0, day: 26, hour: 16, minute: 39 },
                    diffInYears: 2,
                    diffInMonths: 24,
                    diffInDays: 757,
                    diffInHours: 18184,
                    diffInMinutes: 1091079,
                },
                description: 'difference between two valid dates across years',
            },
            {
                args: ['2020-01-01 18:10:30', '2020-01-05 10:50:10'],
                expected: {
                    byUnit: { year: 0, month: 0, day: 3, hour: 16, minute: 39 },
                    diffInYears: 0,
                    diffInMonths: 0,
                    diffInDays: 3,
                    diffInHours: 88,
                    diffInMinutes: 5319,
                },
                description: 'difference within same month',
            },
            {
                args: ['2020-12-31', '2021-01-01'],
                expected: {
                    byUnit: { year: 0, month: 0, day: 1, hour: 0, minute: 0 },
                    diffInYears: 0,
                    diffInMonths: 0,
                    diffInDays: 1,
                    diffInHours: 24,
                    diffInMinutes: 1440,
                },
                description: 'difference crossing year boundary',
            },
            {
                args: [new Date('2020-06-01'), new Date('2020-06-01')],
                expected: {
                    byUnit: { year: 0, month: 0, day: 0, hour: 0, minute: 0 },
                    diffInYears: 0,
                    diffInMonths: 0,
                    diffInDays: 0,
                    diffInHours: 0,
                    diffInMinutes: 0,
                },
                description: 'same date returns zero',
            },
            {
                args: ['2024-07-01T12:00:00-05:00', '2024-07-02T03:30:00Z'],
                expected: {
                    byUnit: { year: 0, month: 0, day: 0, hour: 10, minute: 30 },
                    diffInYears: 0,
                    diffInMonths: 0,
                    diffInDays: 0,
                    diffInHours: 10,
                    diffInMinutes: 630,
                },
                description: 'first date in GMT-5 and second in UTC crossing midnight',
            },
        ])('should calculate $description', async ({ args, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'dateDifference';

                // Act
                const result = wsFunction.execute(...args);

                // Assert
                expect(result).toEqual(
                    expect.objectContaining({
                        byUnit: expect.objectContaining(expected.byUnit),
                        diffInYears: expected.diffInYears,
                        diffInMonths: expected.diffInMonths,
                        diffInDays: expected.diffInDays,
                        diffInHours: expected.diffInHours,
                        diffInMinutes: expected.diffInMinutes,
                    })
                );
            });
        });

        it('should throw for invalid start date', async () => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'dateDifference';

                // Act & Assert
                expect(() => wsFunction.execute('invalid-date', '2020-01-05')).toThrow('Invalid startDate format');
            });
        });

        it('should throw for invalid end date', async () => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'dateDifference';

                // Act & Assert
                expect(() => wsFunction.execute('2020-01-01', 'invalid-date')).toThrow('Invalid endDate format');
            });
        });
    });

    describe('#toUpperCase', () => {
        it.each([
            { input: 'hello world', expected: 'HELLO WORLD', description: 'lowercase to uppercase' },
            { input: 'Already Uppercase', expected: 'ALREADY UPPERCASE', description: 'mixed case to uppercase' },
            { input: 'TeSt123', expected: 'TEST123', description: 'alphanumeric strings' },
        ])('should return "$expected" for $description', async ({ input, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'toUpperCase';

                // Act
                const result = wsFunction.execute(input);

                // Assert
                expect(result).toBe(expected);
            });
        });

        it.each([
            { input: 123, description: 'non-string input' },
            { input: null, description: 'null input' },
            { input: undefined, description: 'undefined input' },
        ])('should throw error for $description', async ({ input }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'toUpperCase';

                // Act & Assert
                expect(() => wsFunction.execute(input)).toThrow('Invalid input toUpperCase: must be a string');
            });
        });
    });

    describe('#toLowerCase', () => {
        it.each([
            { input: 'HELLO WORLD', expected: 'hello world', description: 'uppercase to lowercase' },
            { input: 'Already lowercase', expected: 'already lowercase', description: 'already lowercase' },
            { input: 'TeSt123', expected: 'test123', description: 'alphanumeric strings' },
        ])('should return "$expected" for $description', async ({ input, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'toLowerCase';

                // Act
                const result = wsFunction.execute(input);

                // Assert
                expect(result).toBe(expected);
            });
        });

        it.each([
            { input: 123, description: 'non-string input' },
            { input: null, description: 'null input' },
            { input: undefined, description: 'undefined input' },
        ])('should throw error for $description', async ({ input }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'toLowerCase';

                // Act & Assert
                expect(() => wsFunction.execute(input)).toThrow('Invalid input toLowerCase: must be a string');
            });
        });
    });

    describe('#encrypt', () => {
        it.each([
            { input: null, description: 'null input' },
            { input: undefined, description: 'undefined input' },
        ])('should throw error for $description', async ({ input }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'encrypt';

                // Act & Assert
                expect(() => wsFunction.execute(input)).toThrow('Text must be a non-empty string');
            });
        });
    });

    describe('#findNewElements', () => {
        describe('with array inputs', () => {
            it('should find new primitive elements', async () => {
                await TenantContext.run(tenant, () => {
                    // Arrange
                    const dto = WSRestFunctionMother.dto();
                    const wsFunction = WSRestFunction.create(dto);
                    wsFunction.type = 'findNewElements';

                    // Act
                    const result = wsFunction.execute([1, 2, 3], [1, 2, 3, 4, 5]);

                    // Assert
                    expect(result).toEqual([4, 5]);
                });
            });

            it('should find new string elements', async () => {
                await TenantContext.run(tenant, () => {
                    // Arrange
                    const dto = WSRestFunctionMother.dto();
                    const wsFunction = WSRestFunction.create(dto);
                    wsFunction.type = 'findNewElements';

                    // Act
                    const result = wsFunction.execute(['hello', 'world'], ['hello', 'world', 'test', 'new']);

                    // Assert
                    expect(result).toEqual(['test', 'new']);
                });
            });

            it('should return empty array when no new elements', async () => {
                await TenantContext.run(tenant, () => {
                    // Arrange
                    const dto = WSRestFunctionMother.dto();
                    const wsFunction = WSRestFunction.create(dto);
                    wsFunction.type = 'findNewElements';

                    // Act
                    const result = wsFunction.execute([1, 2, 3], [1, 2, 3]);

                    // Assert
                    expect(result).toEqual([]);
                });
            });

            it('should find new objects in array', async () => {
                await TenantContext.run(tenant, () => {
                    // Arrange
                    const dto = WSRestFunctionMother.dto();
                    const wsFunction = WSRestFunction.create(dto);
                    wsFunction.type = 'findNewElements';
                    const original = [
                        { id: 1, name: 'Juan' },
                        { id: 2, name: 'María' },
                    ];
                    const updated = [
                        { id: 1, name: 'Juan' },
                        { id: 2, name: 'María' },
                        { id: 3, name: 'Pedro' },
                    ];

                    // Act
                    const result = wsFunction.execute(original, updated);

                    // Assert
                    expect(result).toEqual([{ id: 3, name: 'Pedro' }]);
                });
            });

            it('should handle empty original array', async () => {
                await TenantContext.run(tenant, () => {
                    // Arrange
                    const dto = WSRestFunctionMother.dto();
                    const wsFunction = WSRestFunction.create(dto);
                    wsFunction.type = 'findNewElements';

                    // Act
                    const result = wsFunction.execute([], [1, 2, 3]);

                    // Assert
                    expect(result).toEqual([1, 2, 3]);
                });
            });

            it('should handle falsy values correctly', async () => {
                await TenantContext.run(tenant, () => {
                    // Arrange
                    const dto = WSRestFunctionMother.dto();
                    const wsFunction = WSRestFunction.create(dto);
                    wsFunction.type = 'findNewElements';
                    const original = [null, undefined, 0, '', false];
                    const updated = [null, undefined, 0, '', false, 'new', 1, true];

                    // Act
                    const result = wsFunction.execute(original, updated);

                    // Assert
                    expect(result).toEqual(['new', 1, true]);
                });
            });

            it('should handle duplicate elements correctly', async () => {
                await TenantContext.run(tenant, () => {
                    // Arrange
                    const dto = WSRestFunctionMother.dto();
                    const wsFunction = WSRestFunction.create(dto);
                    wsFunction.type = 'findNewElements';

                    // Act
                    const result = wsFunction.execute([1, 1, 2, 2], [1, 1, 2, 2, 3, 3]);

                    // Assert
                    expect(result).toEqual([3, 3]);
                });
            });

            it('should handle mixed data types in arrays', async () => {
                await TenantContext.run(tenant, () => {
                    // Arrange
                    const dto = WSRestFunctionMother.dto();
                    const wsFunction = WSRestFunction.create(dto);
                    wsFunction.type = 'findNewElements';
                    const original = [1, 'string', { id: 1 }, [1, 2]];
                    const updated = [1, 'string', { id: 1 }, [1, 2], null, true, { id: 2 }];

                    // Act
                    const result = wsFunction.execute(original, updated);

                    // Assert
                    expect(result).toEqual([null, true, { id: 2 }]);
                });
            });

            it('should handle Date objects in arrays', async () => {
                await TenantContext.run(tenant, () => {
                    // Arrange
                    const dto = WSRestFunctionMother.dto();
                    const wsFunction = WSRestFunction.create(dto);
                    wsFunction.type = 'findNewElements';
                    const date1 = new Date('2023-01-01').getTime();
                    const date2 = new Date('2023-01-02').getTime();
                    const date3 = new Date('2023-01-03').getTime();

                    // Act
                    const result = wsFunction.execute([date1, date2], [date1, date2, date3]);

                    // Assert
                    expect(result).toEqual([date3]);
                });
            });

            it('should handle boolean values correctly', async () => {
                await TenantContext.run(tenant, () => {
                    // Arrange
                    const dto = WSRestFunctionMother.dto();
                    const wsFunction = WSRestFunction.create(dto);
                    wsFunction.type = 'findNewElements';

                    // Act
                    const result = wsFunction.execute([true, false], [true, false, null, 0, '']);

                    // Assert
                    expect(result).toEqual([null, 0, '']);
                });
            });

            it('should find new nested objects', async () => {
                await TenantContext.run(tenant, () => {
                    // Arrange
                    const dto = WSRestFunctionMother.dto();
                    const wsFunction = WSRestFunction.create(dto);
                    wsFunction.type = 'findNewElements';
                    const original = [{ id: 1, items: [1, 2] }];
                    const updated = [
                        { id: 1, items: [1, 2] },
                        { id: 2, items: [3, 4] },
                    ];

                    // Act
                    const result = wsFunction.execute(original, updated);

                    // Assert
                    expect(result).toEqual([{ id: 2, items: [3, 4] }]);
                });
            });

            it('should find new nested arrays', async () => {
                await TenantContext.run(tenant, () => {
                    // Arrange
                    const dto = WSRestFunctionMother.dto();
                    const wsFunction = WSRestFunction.create(dto);
                    wsFunction.type = 'findNewElements';
                    const original = [
                        [1, 2],
                        [3, 4],
                    ];
                    const updated = [
                        [1, 2],
                        [3, 4],
                        [5, 6],
                    ];

                    // Act
                    const result = wsFunction.execute(original, updated);

                    // Assert
                    expect(result).toEqual([[5, 6]]);
                });
            });
        });

        describe('with JSON string inputs', () => {
            it('should parse JSON strings and find new elements', async () => {
                await TenantContext.run(tenant, () => {
                    // Arrange
                    const dto = WSRestFunctionMother.dto();
                    const wsFunction = WSRestFunction.create(dto);
                    wsFunction.type = 'findNewElements';

                    // Act
                    const result = wsFunction.execute('[1, 2, 3]', '[1, 2, 3, 4, 5]');

                    // Assert
                    expect(result).toEqual([4, 5]);
                });
            });

            it('should parse JSON string arrays with strings', async () => {
                await TenantContext.run(tenant, () => {
                    // Arrange
                    const dto = WSRestFunctionMother.dto();
                    const wsFunction = WSRestFunction.create(dto);
                    wsFunction.type = 'findNewElements';

                    // Act
                    const result = wsFunction.execute('["a", "b"]', '["a", "b", "c"]');

                    // Assert
                    expect(result).toEqual(['c']);
                });
            });
        });

        describe('object key order independence', () => {
            it('should not consider objects with different property order as new elements', async () => {
                await TenantContext.run(tenant, () => {
                    // Arrange
                    const dto = WSRestFunctionMother.dto();
                    const wsFunction = WSRestFunction.create(dto);
                    wsFunction.type = 'findNewElements';
                    const original = [{ date: '2025-07-09', stage: 7 }];
                    const updated = [{ stage: 7, date: '2025-07-09' }];

                    // Act
                    const result = wsFunction.execute(original, updated);

                    // Assert
                    expect(result).toEqual([]);
                });
            });

            it('should handle complex objects with nested properties in different order', async () => {
                await TenantContext.run(tenant, () => {
                    // Arrange
                    const dto = WSRestFunctionMother.dto();
                    const wsFunction = WSRestFunction.create(dto);
                    wsFunction.type = 'findNewElements';
                    const original = [
                        { user: { name: 'Juan', age: 30 }, active: true, permissions: ['read', 'write'] },
                    ];
                    const updated = [{ permissions: ['read', 'write'], user: { age: 30, name: 'Juan' }, active: true }];

                    // Act
                    const result = wsFunction.execute(original, updated);

                    // Assert
                    expect(result).toEqual([]);
                });
            });

            it('should handle arrays with different object structures', async () => {
                await TenantContext.run(tenant, () => {
                    // Arrange
                    const dto = WSRestFunctionMother.dto();
                    const wsFunction = WSRestFunction.create(dto);
                    wsFunction.type = 'findNewElements';
                    const original = [{ type: 'user', id: 1 }];
                    const updated = [
                        { type: 'user', id: 1 },
                        { type: 'admin', id: 2, permissions: ['read', 'write'] },
                    ];

                    // Act
                    const result = wsFunction.execute(original, updated);

                    // Assert
                    expect(result).toEqual([{ type: 'admin', id: 2, permissions: ['read', 'write'] }]);
                });
            });

            it('should handle complex nested structures', async () => {
                await TenantContext.run(tenant, () => {
                    // Arrange
                    const dto = WSRestFunctionMother.dto();
                    const wsFunction = WSRestFunction.create(dto);
                    wsFunction.type = 'findNewElements';
                    const original = [{ user: { id: 1, profile: { name: 'Juan' } } }];
                    const updated = [
                        { user: { id: 1, profile: { name: 'Juan' } } },
                        { user: { id: 2, profile: { name: 'María' } } },
                    ];

                    // Act
                    const result = wsFunction.execute(original, updated);

                    // Assert
                    expect(result).toEqual([{ user: { id: 2, profile: { name: 'María' } } }]);
                });
            });
        });

        describe('error handling', () => {
            it('should throw error for null original value', async () => {
                await TenantContext.run(tenant, () => {
                    // Arrange
                    const dto = WSRestFunctionMother.dto();
                    const wsFunction = WSRestFunction.create(dto);
                    wsFunction.type = 'findNewElements';

                    // Act & Assert
                    expect(() => wsFunction.execute(null, [1, 2, 3])).toThrow(
                        'value must be an array or JSON string representing an array'
                    );
                });
            });

            it('should return empty array for undefined updated value', async () => {
                await TenantContext.run(tenant, () => {
                    // Arrange
                    const dto = WSRestFunctionMother.dto();
                    const wsFunction = WSRestFunction.create(dto);
                    wsFunction.type = 'findNewElements';

                    // Act
                    const result = wsFunction.execute([1, 2, 3], undefined);

                    // Assert
                    expect(result).toEqual([]);
                });
            });

            it('should throw error for invalid JSON string', async () => {
                await TenantContext.run(tenant, () => {
                    // Arrange
                    const dto = WSRestFunctionMother.dto();
                    const wsFunction = WSRestFunction.create(dto);
                    wsFunction.type = 'findNewElements';

                    // Act & Assert
                    expect(() => wsFunction.execute('invalid-json', [1, 2, 3])).toThrow('Invalid JSON string provided');
                });
            });

            it('should throw error when original is not array', async () => {
                await TenantContext.run(tenant, () => {
                    // Arrange
                    const dto = WSRestFunctionMother.dto();
                    const wsFunction = WSRestFunction.create(dto);
                    wsFunction.type = 'findNewElements';

                    // Act & Assert
                    expect(() => wsFunction.execute({ name: 'test' }, [1, 2, 3])).toThrow(
                        'value must be an array or JSON string representing an array'
                    );
                });
            });

            it('should throw error when updated is not array', async () => {
                await TenantContext.run(tenant, () => {
                    // Arrange
                    const dto = WSRestFunctionMother.dto();
                    const wsFunction = WSRestFunction.create(dto);
                    wsFunction.type = 'findNewElements';

                    // Act & Assert
                    expect(() => wsFunction.execute([1, 2, 3], 'not an array')).toThrow('Invalid JSON string provided');
                });
            });
        });
    });

    describe('#convertToTimezone', () => {
        it.each([
            {
                args: ['2024-01-15T10:30:00Z', 'America/Bogota', 'YYYY-MM-DD HH:mm:ss'],
                expected: '2024-01-15 05:30:00',
                description: 'UTC to Bogota',
            },
            {
                args: ['2024-06-15T10:30:00Z', 'America/New_York', 'YYYY-MM-DD HH:mm:ss'],
                expected: '2024-06-15 06:30:00',
                description: 'UTC to New York (EDT)',
            },
            {
                args: ['2024-01-15T15:30:00Z', 'Europe/London', 'DD/MM/YYYY HH:mm:ss'],
                expected: '15/01/2024 15:30:00',
                description: 'UTC to London with custom format',
            },
            {
                args: ['2024-01-15T12:00:00Z', 'Asia/Tokyo', 'YYYY-MM-DD HH:mm:ss'],
                expected: '2024-01-15 21:00:00',
                description: 'UTC to Tokyo',
            },
            {
                args: ['2024-07-15T12:00:00Z', 'America/Los_Angeles', 'MM/DD/YYYY HH:mm:ss'],
                expected: '07/15/2024 05:00:00',
                description: 'UTC to Los Angeles (PDT) with US format',
            },
            {
                args: ['2024-01-15T10:30:00Z', 'UTC', 'YYYY-MM-DD HH:mm:ss'],
                expected: '2024-01-15 10:30:00',
                description: 'UTC to UTC (no change)',
            },
            {
                args: ['2024-01-15T10:30:00Z', 'America/Bogota'],
                expected: '2024-01-15 05:30:00',
                description: 'default format YYYY-MM-DD HH:mm:ss',
            },
            {
                args: [new Date('2024-01-15T10:30:00Z'), 'Europe/Madrid', 'DD-MM-YYYY HH:mm:ss'],
                expected: '15-01-2024 11:30:00',
                description: 'Date object input to Madrid',
            },
        ])('should return "$expected" for $description', async ({ args, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'convertToTimezone';

                // Act
                const result = wsFunction.execute(...args);

                // Assert
                expect(result).toBe(expected);
            });
        });

        it.each([
            {
                args: ['2024-03-10T07:00:00Z', 'America/New_York', 'YYYY-MM-DD HH:mm:ss'],
                expected: '2024-03-10 03:00:00',
                description: 'spring forward',
            },
            {
                args: ['2024-11-03T06:00:00Z', 'America/New_York', 'YYYY-MM-DD HH:mm:ss'],
                expected: '2024-11-03 01:00:00',
                description: 'fall back',
            },
            {
                args: ['2024-02-29T12:00:00Z', 'Australia/Sydney', 'YYYY-MM-DD HH:mm:ss'],
                expected: '2024-02-29 23:00:00',
                description: 'leap year date to Sydney',
            },
        ])('should handle DST transition: $description', async ({ args, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'convertToTimezone';

                // Act
                const result = wsFunction.execute(...args);

                // Assert
                expect(result).toBe(expected);
            });
        });

        it.each([
            { args: [null, 'America/Bogota', 'YYYY-MM-DD HH:mm:ss'], expected: 'Date cannot be null or undefined' },
            {
                args: [undefined, 'America/Bogota', 'YYYY-MM-DD HH:mm:ss'],
                expected: 'Date cannot be null or undefined',
            },
            {
                args: ['2024-01-15T10:30:00Z', '', 'YYYY-MM-DD HH:mm:ss'],
                expected: 'Target timezone must be a non-empty string',
            },
            {
                args: ['2024-01-15T10:30:00Z', null, 'YYYY-MM-DD HH:mm:ss'],
                expected: 'Target timezone must be a non-empty string',
            },
            {
                args: ['invalid-date', 'America/Bogota', 'YYYY-MM-DD HH:mm:ss'],
                expected: 'Invalid date format',
            },
            {
                args: ['2024-01-15T10:30:00Z', 'Invalid/Timezone', 'YYYY-MM-DD HH:mm:ss'],
                expected: 'Invalid timezone: Invalid/Timezone',
            },
            {
                args: [123, 'America/Bogota', 'YYYY-MM-DD HH:mm:ss'],
                expected: 'Date must be a string or Date object',
            },
            {
                args: [true, 'America/Bogota', 'YYYY-MM-DD HH:mm:ss'],
                expected: 'Date must be a string or Date object',
            },
        ])('should throw "$expected" for invalid input', async ({ args, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'convertToTimezone';

                // Act & Assert
                expect(() => wsFunction.execute(...args)).toThrow(expected);
            });
        });

        it('should handle summer/winter time differences correctly', async () => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'convertToTimezone';

                // Act
                const winterResult = wsFunction.execute('2024-01-15T12:00:00Z', 'Europe/London', 'HH:mm:ss');
                const summerResult = wsFunction.execute('2024-07-15T12:00:00Z', 'Europe/London', 'HH:mm:ss');

                // Assert
                expect(winterResult).toBe('12:00:00');
                expect(summerResult).toBe('13:00:00');
            });
        });

        it('should handle different input date formats consistently', async () => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'convertToTimezone';
                const isoString = '2024-01-15T10:30:00.000Z';
                const dateObject = new Date('2024-01-15T10:30:00.000Z');
                const simpleDateString = '2024-01-15T10:30:00Z';

                // Act
                const result1 = wsFunction.execute(isoString, 'America/Bogota');
                const result2 = wsFunction.execute(dateObject, 'America/Bogota');
                const result3 = wsFunction.execute(simpleDateString, 'America/Bogota');

                // Assert
                expect(result1).toBe(result2);
                expect(result2).toBe(result3);
            });
        });

        it('should work with common timezone identifiers', async () => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'convertToTimezone';
                const timezones = [
                    'UTC',
                    'America/New_York',
                    'America/Los_Angeles',
                    'Europe/London',
                    'Europe/Paris',
                    'Asia/Tokyo',
                    'Australia/Sydney',
                    'America/Bogota',
                    'America/Mexico_City',
                ];

                // Act & Assert
                timezones.forEach((tz) => {
                    expect(() => wsFunction.execute('2024-01-15T12:00:00Z', tz, 'YYYY-MM-DD HH:mm:ss')).not.toThrow();
                });
            });
        });

        it.each([
            {
                args: ['2024-01-15T10:30:00-05:00', 'UTC', 'YYYY-MM-DD HH:mm:ss'],
                expected: '2024-01-15 15:30:00',
                description: 'ISO string with -05:00 offset to UTC',
            },
            {
                args: ['2024-01-15T00:00:00-05:00', 'UTC', 'YYYY-MM-DD HH:mm:ss'],
                expected: '2024-01-15 05:00:00',
                description: 'midnight at -05:00 to UTC',
            },
            {
                args: ['2024-01-15T23:00:00-05:00', 'UTC', 'YYYY-MM-DD HH:mm:ss'],
                expected: '2024-01-16 04:00:00',
                description: '-05:00 date that crosses midnight when converted to UTC',
            },
            {
                args: [new Date('2024-06-15T10:30:00-05:00'), 'UTC', 'YYYY-MM-DD HH:mm:ss'],
                expected: '2024-06-15 15:30:00',
                description: 'Date object from -05:00 string to UTC',
            },
            {
                args: ['2024-03-20T08:00:00-05:00', 'UTC', 'YYYY-MM-DDTHH:mm:ss'],
                expected: '2024-03-20T13:00:00',
                description: '-05:00 to UTC with ISO output format',
            },
        ])('should convert -05:00 offset date to UTC: $description', async ({ args, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'convertToTimezone';

                // Act
                const result = wsFunction.execute(...args);

                // Assert
                expect(result).toBe(expected);
            });
        });
    });

    describe('#reverseArray', () => {
        it.each([
            { input: [[1, 2, 3, 4, 5]], expected: [5, 4, 3, 2, 1], description: 'array of numbers' },
            { input: [['a', 'b', 'c', 'd']], expected: ['d', 'c', 'b', 'a'], description: 'array of strings' },
            {
                input: [[true, false, null, undefined]],
                expected: [null, null, false, true],
                description: 'array with mixed primitive types',
            },
            { input: [[]], expected: [], description: 'empty array' },
            { input: [['single']], expected: ['single'], description: 'single element array' },
            {
                input: [
                    [
                        { id: 1, name: 'John' },
                        { id: 2, name: 'Jane' },
                        { id: 3, name: 'Bob' },
                    ],
                ],
                expected: [
                    { id: 3, name: 'Bob' },
                    { id: 2, name: 'Jane' },
                    { id: 1, name: 'John' },
                ],
                description: 'array of objects',
            },
            {
                input: [
                    [
                        [1, 2],
                        [3, 4],
                        [5, 6],
                    ],
                ],
                expected: [
                    [5, 6],
                    [3, 4],
                    [1, 2],
                ],
                description: 'array of arrays',
            },
            {
                input: [[1, 'hello', { id: 1 }, [1, 2], null, true]],
                expected: [true, null, [1, 2], { id: 1 }, 'hello', 1],
                description: 'array with mixed data types',
            },
            { input: ['[1, 2, 3, 4, 5]'], expected: [5, 4, 3, 2, 1], description: 'array from JSON string' },
            { input: ['[]'], expected: [], description: 'empty array from JSON string' },
            {
                input: [['', ' ', '  hello  ', '\n', '\t']],
                expected: ['\t', '\n', '  hello  ', ' ', ''],
                description: 'array with whitespace strings',
            },
        ])('should reverse $description', async ({ input, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'reverseArray';

                // Act
                const result = wsFunction.execute(...input);

                // Assert
                expect(result).toEqual(expected);
            });
        });

        it.each([
            { input: ['not-a-json-array'], expected: 'Invalid JSON string provided for reverseArray' },
            { input: ['{"key": "value"}'], expected: 'Input must be an array or JSON string representing an array' },
            { input: [123], expected: 'Input must be an array or JSON string representing an array' },
            { input: [{ key: 'value' }], expected: 'Input must be an array or JSON string representing an array' },
            { input: ['[1, 2, 3'], expected: 'Invalid JSON string provided for reverseArray' },
        ])('should throw "$expected" for invalid input', async ({ input, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'reverseArray';

                // Act & Assert
                expect(() => wsFunction.execute(...input)).toThrow(expected);
            });
        });

        it('should not mutate the original array', async () => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'reverseArray';
                const originalArray = [1, 2, 3, 4, 5];
                const originalArrayCopy = [...originalArray];

                // Act
                const result = wsFunction.execute(originalArray);

                // Assert
                expect(originalArray).toEqual(originalArrayCopy);
                expect(result).toEqual([5, 4, 3, 2, 1]);
                expect(result).not.toBe(originalArray);
            });
        });
    });

    describe('#generateUUID', () => {
        it('should generate a valid UUID', async () => {
            await TenantContext.run(tenant, () => {
                const wsFunction = WSRestFunction.create(WSRestFunctionMother.dto({ type: 'generateUUID' }));

                const result = wsFunction.execute();

                expect(ValueObjectUuid.isValidUuid(result)).toBe(true);
            });
        });

        it('should generate a different UUID on each call', async () => {
            await TenantContext.run(tenant, () => {
                const wsFunction = WSRestFunction.create(WSRestFunctionMother.dto({ type: 'generateUUID' }));

                const firstUuid = wsFunction.execute();
                const secondUuid = wsFunction.execute();

                expect(firstUuid).not.toBe(secondUuid);
            });
        });
    });

    describe('#addToContext', () => {
        it('should return a JSON object or array as-is', async () => {
            await TenantContext.run(tenant, () => {
                const wsFunction = WSRestFunction.create(WSRestFunctionMother.dto({ type: 'addToContext' }));

                const obj = { case_id: '123', status: 'closed' };
                const arr = [1, 2, { key: 'value' }];

                expect(wsFunction.execute(obj)).toEqual(obj);
                expect(wsFunction.execute(arr)).toEqual(arr);
            });
        });

        it('should parse a valid JSON string (object or array) and return it', async () => {
            await TenantContext.run(tenant, () => {
                const wsFunction = WSRestFunction.create(WSRestFunctionMother.dto({ type: 'addToContext' }));

                expect(wsFunction.execute('{"id": 1}')).toEqual({ id: 1 });
                expect(wsFunction.execute('[1, 2]')).toEqual([1, 2]);
            });
        });

        it('should return plain strings as-is (non-JSON) or with context refs', async () => {
            await TenantContext.run(tenant, () => {
                const wsFunction = WSRestFunction.create(WSRestFunctionMother.dto({ type: 'addToContext' }));

                expect(wsFunction.execute('just a string')).toBe('just a string');
                expect(wsFunction.execute('{"id": "context.id"}')).toEqual({ id: 'context.id' });
            });
        });

        it('should throw error for null or undefined input', async () => {
            await TenantContext.run(tenant, () => {
                const wsFunction = WSRestFunction.create(WSRestFunctionMother.dto({ type: 'addToContext' }));

                expect(() => wsFunction.execute(null)).toThrow('Value cannot be null or undefined for addToContext');
                expect(() => wsFunction.execute(undefined)).toThrow(
                    'Value cannot be null or undefined for addToContext'
                );
            });
        });
    });

    describe('#mapProperty', () => {
        it('should return null or undefined as-is', async () => {
            await TenantContext.run(tenant, () => {
                const wsFunction = WSRestFunction.create(WSRestFunctionMother.dto({ type: 'mapProperty' }));

                expect(wsFunction.execute(null)).toBeNull();
                expect(wsFunction.execute(undefined)).toBeUndefined();
            });
        });

        it('should return primitive values as-is', async () => {
            await TenantContext.run(tenant, () => {
                const wsFunction = WSRestFunction.create(WSRestFunctionMother.dto({ type: 'mapProperty' }));

                expect(wsFunction.execute('string')).toBe('string');
                expect(wsFunction.execute(123)).toBe(123);
                expect(wsFunction.execute(true)).toBe(true);
            });
        });

        it('should return a deep clone of objects and arrays', async () => {
            await TenantContext.run(tenant, () => {
                const wsFunction = WSRestFunction.create(WSRestFunctionMother.dto({ type: 'mapProperty' }));

                const obj = { a: 1, b: { c: 2 } };
                const arr = [1, [2, 3]];

                const clonedObj = wsFunction.execute(obj);
                const clonedArr = wsFunction.execute(arr);

                expect(clonedObj).toEqual(obj);
                expect(clonedObj).not.toBe(obj);
                expect(clonedObj.b).not.toBe(obj.b);

                expect(clonedArr).toEqual(arr);
                expect(clonedArr).not.toBe(arr);
                expect(clonedArr[1]).not.toBe(arr[1]);
            });
        });

        it('should throw InvalidArgumentError for non-serializable objects (circular references)', async () => {
            await TenantContext.run(tenant, () => {
                const wsFunction = WSRestFunction.create(WSRestFunctionMother.dto({ type: 'mapProperty' }));

                const circular = { a: 1 };
                circular.self = circular;

                expect(() => wsFunction.execute(circular)).toThrow('mapProperty: context value is not serializable');
            });
        });
    });

    describe('#regexOr', () => {
        it.each([
            {
                args: ['abc123', 'xyz', '^[a-z]+[0-9]+$'],
                expected: 'abc123',
                description: 'val1 cumple el regex → retorna val1',
            },
            {
                args: ['hello', 'world99', '^[a-z]+[0-9]+$'],
                expected: 'world99',
                description: 'val1 no cumple, val2 cumple → retorna val2',
            },
            {
                args: ['hello', 'world', '^[0-9]+$'],
                expected: null,
                description: 'ninguno cumple → retorna null',
            },
            {
                args: ['abc123', null, '^[a-z]+[0-9]+$'],
                expected: 'abc123',
                description: 'val2 es null, val1 cumple → retorna val1',
            },
            {
                args: [null, 'world99', '^[a-z]+[0-9]+$'],
                expected: 'world99',
                description: 'val1 es null, val2 cumple → retorna val2',
            },
            {
                args: [null, null, '^[a-z]+$'],
                expected: null,
                description: 'ambos null → retorna null',
            },
            {
                args: [42, 'test', '^[0-9]+$'],
                expected: 42,
                description: 'val1 numérico coercido a string, cumple → retorna el número original',
            },
            {
                args: ['test', 42, '^[0-9]+$'],
                expected: 42,
                description: 'val2 numérico coercido a string, cumple → retorna el número original',
            },
            {
                args: [undefined, 'world99', '^[a-z]+[0-9]+$'],
                expected: 'world99',
                description: 'val1 ausente del contexto (undefined), val2 cumple → retorna val2',
            },
            {
                args: ['abc123', undefined, '^[a-z]+[0-9]+$'],
                expected: 'abc123',
                description: 'val2 ausente del contexto (undefined), val1 cumple → retorna val1',
            },
            {
                args: [undefined, undefined, '^[a-z]+$'],
                expected: null,
                description: 'ambos valores ausentes del contexto (undefined) → retorna null',
            },
            {
                args: [undefined, 'hello', '^[0-9]+$'],
                expected: null,
                description: 'val1 ausente del contexto, val2 no cumple → retorna null',
            },
        ])('should return expected for: $description', async ({ args, expected }) => {
            await TenantContext.run(tenant, () => {
                const wsFunction = WSRestFunction.create(
                    WSRestFunctionMother.dto({ type: 'regexOr', value_static: args[2] })
                );

                const result = wsFunction.execute(...args);

                expect(result).toBe(expected);
            });
        });

        it.each([
            { args: ['abc', 'xyz', ''], description: 'patrón vacío' },
            { args: ['abc', 'xyz', '   '], description: 'patrón solo espacios en blanco' },
        ])('should throw for: $description', async ({ args }) => {
            await TenantContext.run(tenant, () => {
                const wsFunction = WSRestFunction.create(
                    WSRestFunctionMother.dto({ type: 'regexOr', value_static: 'placeholder' })
                );

                expect(() => wsFunction.execute(...args)).toThrow('regexOr: pattern must be a non-empty string');
            });
        });

        it('should throw when value_static is null for regexOr (domain validation)', async () => {
            await TenantContext.run(tenant, () => {
                // Spread to override Mother's ?? default which would replace null
                const dto = { ...WSRestFunctionMother.dto({ type: 'regexOr' }), value_static: null };
                expect(() => WSRestFunction.create(dto)).toThrow(
                    'value_static must be a non-empty string for function type "regexOr"'
                );
            });
        });

        it('should throw when value_static is empty string for regexOr (domain validation)', async () => {
            await TenantContext.run(tenant, () => {
                expect(() =>
                    WSRestFunction.create(WSRestFunctionMother.dto({ type: 'regexOr', value_static: '' }))
                ).toThrow('value_static must be a non-empty string for function type "regexOr"');
            });
        });
    });

    describe('#divide', () => {
        it.each([
            { dividend: 10, divisor: 2, expected: 5, description: 'positive numbers' },
            { dividend: 10, divisor: -2, expected: -5, description: 'positive by negative' },
            { dividend: -10, divisor: 2, expected: -5, description: 'negative by positive' },
            { dividend: -10, divisor: -2, expected: 5, description: 'negative numbers' },
            { dividend: 0, divisor: 5, expected: 0, description: 'zero divided' },
            { dividend: 10, divisor: 3, expected: 3.3333333333333335, description: 'decimal result' },
            { dividend: 7.5, divisor: 2.5, expected: 3, description: 'decimal numbers' },
            { dividend: '10', divisor: 2, expected: 5, description: 'string as dividend' },
            { dividend: 10, divisor: '2', expected: 5, description: 'string as divisor' },
            { dividend: '10', divisor: '2', expected: 5, description: 'strings as both' },
        ])('should return $expected when dividing $description', async ({ dividend, divisor, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'divide';

                // Act
                const result = wsFunction.execute(dividend, divisor);

                // Assert
                expect(result).toBe(expected);
            });
        });

        it.each([
            { dividend: 10, divisor: 0, description: 'division by zero' },
            { dividend: null, divisor: 2, description: 'null dividend' },
            { dividend: 10, divisor: null, description: 'null divisor' },
            { dividend: undefined, divisor: 2, description: 'undefined dividend' },
            { dividend: 10, divisor: undefined, description: 'undefined divisor' },
            { dividend: 'abc', divisor: 2, description: 'non-numeric string as dividend' },
            { dividend: 10, divisor: 'abc', description: 'non-numeric string as divisor' },
        ])('should throw error for $description', async ({ dividend, divisor }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'divide';

                // Act & Assert
                expect(() => wsFunction.execute(dividend, divisor)).toThrow(/divide:/);
            });
        });

        it('should throw when value_static is null for divide (domain validation)', async () => {
            await TenantContext.run(tenant, () => {
                const dto = WSRestFunctionMother.dto({ type: 'divide', value_static: null });
                expect(() => WSRestFunction.create(dto)).toThrow(
                    'value_static must be a valid number for function type "divide"'
                );
            });
        });

        it('should throw when value_static is not a valid number for divide (domain validation)', async () => {
            await TenantContext.run(tenant, () => {
                expect(() =>
                    WSRestFunction.create(WSRestFunctionMother.dto({ type: 'divide', value_static: 'invalid' }))
                ).toThrow('value_static must be a valid number for function type "divide"');
            });
        });
    });

    describe('#subtract', () => {
        it.each([
            { minuend: 10, subtrahend: 3, expected: 7, description: 'positive numbers' },
            { minuend: 10, subtrahend: -3, expected: 13, description: 'positive minus negative' },
            { minuend: -10, subtrahend: 3, expected: -13, description: 'negative minus positive' },
            { minuend: -10, subtrahend: -3, expected: -7, description: 'negative numbers' },
            { minuend: 0, subtrahend: 5, expected: -5, description: 'zero minus number' },
            { minuend: 5, subtrahend: 0, expected: 5, description: 'number minus zero' },
            { minuend: 10.5, subtrahend: 3.2, expected: 7.3, description: 'decimal numbers' },
            { minuend: '10', subtrahend: 3, expected: 7, description: 'string as minuend' },
            { minuend: 10, subtrahend: '3', expected: 7, description: 'string as subtrahend' },
            { minuend: '10', subtrahend: '3', expected: 7, description: 'strings as both' },
        ])('should return $expected when subtracting $description', async ({ minuend, subtrahend, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'subtract';

                // Act
                const result = wsFunction.execute(minuend, subtrahend);

                // Assert
                expect(result).toBeCloseTo(expected, 10);
            });
        });

        it.each([
            { minuend: null, subtrahend: 2, description: 'null minuend' },
            { minuend: 10, subtrahend: null, description: 'null subtrahend' },
            { minuend: undefined, subtrahend: 2, description: 'undefined minuend' },
            { minuend: 10, subtrahend: undefined, description: 'undefined subtrahend' },
            { minuend: 'abc', subtrahend: 2, description: 'non-numeric string as minuend' },
            { minuend: 10, subtrahend: 'abc', description: 'non-numeric string as subtrahend' },
        ])('should throw error for $description', async ({ minuend, subtrahend }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'subtract';

                // Act & Assert
                expect(() => wsFunction.execute(minuend, subtrahend)).toThrow(/subtract:/);
            });
        });

        it('should throw when value_static is null for subtract (domain validation)', async () => {
            await TenantContext.run(tenant, () => {
                const dto = WSRestFunctionMother.dto({ type: 'subtract', value_static: null });
                expect(() => WSRestFunction.create(dto)).toThrow(
                    'value_static must be a valid number for function type "subtract"'
                );
            });
        });

        it('should throw when value_static is not a valid number for subtract (domain validation)', async () => {
            await TenantContext.run(tenant, () => {
                expect(() =>
                    WSRestFunction.create(WSRestFunctionMother.dto({ type: 'subtract', value_static: 'invalid' }))
                ).toThrow('value_static must be a valid number for function type "subtract"');
            });
        });
    });

    describe('#add', () => {
        it.each([
            { augend: 5, addend: 3, expected: 8, description: 'positive numbers' },
            { augend: 5, addend: -3, expected: 2, description: 'positive plus negative' },
            { augend: -5, addend: 3, expected: -2, description: 'negative plus positive' },
            { augend: -5, addend: -3, expected: -8, description: 'negative numbers' },
            { augend: 0, addend: 5, expected: 5, description: 'zero plus number' },
            { augend: 5, addend: 0, expected: 5, description: 'number plus zero' },
            { augend: 10.5, addend: 3.2, expected: 13.7, description: 'decimal numbers' },
            { augend: '5', addend: 3, expected: 8, description: 'string as augend' },
            { augend: 5, addend: '3', expected: 8, description: 'string as addend' },
            { augend: '5', addend: '3', expected: 8, description: 'strings as both' },
        ])('should return $expected when adding $description', async ({ augend, addend, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'add';

                // Act
                const result = wsFunction.execute(augend, addend);

                // Assert
                expect(result).toBeCloseTo(expected, 10);
            });
        });

        it.each([
            { augend: null, addend: 2, description: 'null augend' },
            { augend: 10, addend: null, description: 'null addend' },
            { augend: undefined, addend: 2, description: 'undefined augend' },
            { augend: 10, addend: undefined, description: 'undefined addend' },
            { augend: 'abc', addend: 2, description: 'non-numeric string as augend' },
            { augend: 10, addend: 'abc', description: 'non-numeric string as addend' },
        ])('should throw error for $description', async ({ augend, addend }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'add';

                // Act & Assert
                expect(() => wsFunction.execute(augend, addend)).toThrow(/add:/);
            });
        });

        it('should throw when value_static is null for add (domain validation)', async () => {
            await TenantContext.run(tenant, () => {
                const dto = WSRestFunctionMother.dto({ type: 'add', value_static: null });
                expect(() => WSRestFunction.create(dto)).toThrow(
                    'value_static must be a valid number for function type "add"'
                );
            });
        });

        it('should throw when value_static is not a valid number for add (domain validation)', async () => {
            await TenantContext.run(tenant, () => {
                expect(() =>
                    WSRestFunction.create(WSRestFunctionMother.dto({ type: 'add', value_static: 'invalid' }))
                ).toThrow('value_static must be a valid number for function type "add"');
            });
        });
    });

    describe('#abs', () => {
        it.each([
            { input: -5, expected: 5, description: 'negative integer' },
            { input: 5, expected: 5, description: 'positive integer' },
            { input: 0, expected: 0, description: 'zero' },
            { input: -3.14, expected: 3.14, description: 'negative decimal' },
            { input: 3.14, expected: 3.14, description: 'positive decimal' },
            { input: '-5', expected: 5, description: 'negative string' },
            { input: '5', expected: 5, description: 'positive string' },
            { input: '-100.5', expected: 100.5, description: 'large negative decimal' },
        ])('should return $expected for $description', async ({ input, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'abs';

                // Act
                const result = wsFunction.execute(input);

                // Assert
                expect(result).toBeCloseTo(expected, 10);
            });
        });

        it.each([
            { input: null, description: 'null input' },
            { input: undefined, description: 'undefined input' },
            { input: 'abc', description: 'non-numeric string' },
            { input: NaN, description: 'NaN input' },
        ])('should throw error for $description', async ({ input }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'abs';

                // Act & Assert
                expect(() => wsFunction.execute(input)).toThrow(/abs:/);
            });
        });
    });

    describe('#ceil', () => {
        it.each([
            { input: 3.2, expected: 4, description: 'positive decimal rounds up' },
            { input: 3.7, expected: 4, description: 'positive decimal rounds up' },
            { input: -3.2, expected: -3, description: 'negative decimal rounds up' },
            { input: -3.7, expected: -3, description: 'negative decimal rounds up' },
            { input: 5, expected: 5, description: 'integer stays same' },
            { input: 0, expected: 0, description: 'zero stays same' },
            { input: '3.2', expected: 4, description: 'string decimal rounds up' },
            { input: '-3.7', expected: -3, description: 'negative string decimal rounds up' },
        ])('should return $expected for $description', async ({ input, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'ceil';

                // Act
                const result = wsFunction.execute(input);

                // Assert
                expect(result).toBe(expected);
            });
        });

        it.each([
            { input: null, description: 'null input' },
            { input: undefined, description: 'undefined input' },
            { input: 'abc', description: 'non-numeric string' },
            { input: NaN, description: 'NaN input' },
        ])('should throw error for $description', async ({ input }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'ceil';

                // Act & Assert
                expect(() => wsFunction.execute(input)).toThrow(/ceil:/);
            });
        });
    });

    describe('#floor', () => {
        it.each([
            { input: 3.2, expected: 3, description: 'positive decimal rounds down' },
            { input: 3.7, expected: 3, description: 'positive decimal rounds down' },
            { input: -3.2, expected: -4, description: 'negative decimal rounds down' },
            { input: -3.7, expected: -4, description: 'negative decimal rounds down' },
            { input: 5, expected: 5, description: 'integer stays same' },
            { input: 0, expected: 0, description: 'zero stays same' },
            { input: '3.2', expected: 3, description: 'string decimal rounds down' },
            { input: '-3.7', expected: -4, description: 'negative string decimal rounds down' },
        ])('should return $expected for $description', async ({ input, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'floor';

                // Act
                const result = wsFunction.execute(input);

                // Assert
                expect(result).toBe(expected);
            });
        });

        it.each([
            { input: null, description: 'null input' },
            { input: undefined, description: 'undefined input' },
            { input: 'abc', description: 'non-numeric string' },
            { input: NaN, description: 'NaN input' },
        ])('should throw error for $description', async ({ input }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'floor';

                // Act & Assert
                expect(() => wsFunction.execute(input)).toThrow(/floor:/);
            });
        });
    });

    describe('#addMinutes', () => {
        it.each([
            {
                date: '2024-01-15T10:00:00Z',
                minutes: 30,
                expected: '2024-01-15T10:30:00.000Z',
                description: 'add 30 minutes',
            },
            {
                date: '2024-01-15T10:00:00Z',
                minutes: 90,
                expected: '2024-01-15T11:30:00.000Z',
                description: 'add 90 minutes',
            },
            {
                date: '2024-01-15T23:30:00Z',
                minutes: 60,
                expected: '2024-01-16T00:30:00.000Z',
                description: 'add 60 minutes crosses midnight',
            },
            {
                date: '2024-01-15T10:00:00Z',
                minutes: 0,
                expected: '2024-01-15T10:00:00.000Z',
                description: 'add 0 minutes',
            },
            {
                date: '2024-01-15T10:00:00Z',
                minutes: -30,
                expected: '2024-01-15T09:30:00.000Z',
                description: 'add negative minutes',
            },
            {
                date: '2024-01-15T10:00:00Z',
                minutes: '45',
                expected: '2024-01-15T10:45:00.000Z',
                description: 'add string minutes',
            },
        ])('should $description', async ({ date, minutes, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'addMinutes';

                // Act
                const result = wsFunction.execute(date, minutes);

                // Assert
                expect(result).toBe(expected);
            });
        });

        it.each([
            { date: null, minutes: 30, description: 'null date' },
            { date: '2024-01-15T10:00:00Z', minutes: 'abc', description: 'invalid minutes' },
            { date: 'invalid-date', minutes: 30, description: 'invalid date' },
            { date: undefined, minutes: 30, description: 'undefined date' },
            { date: '2024-01-15T10:30:00', minutes: '30,Invalid/Timezone', description: 'invalid timezone' },
        ])('should throw error for $description', async ({ date, minutes }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'addMinutes';

                // Act & Assert
                expect(() => wsFunction.execute(date, minutes)).toThrow(/addMinutes:/);
            });
        });

        it.each([
            {
                date: '2024-01-15T10: 30: 00',
                minutes: '30,America/Bogota',
                expected: '2024-01-15T16:00:00.000Z',
                description: 'naive date in Bogota (-5) → correct UTC (click API scenario)',
            },
            {
                date: '2024-01-15T23:45:00',
                minutes: '30,America/Bogota',
                expected: '2024-01-16T05:15:00.000Z',
                description: 'naive date Bogota crosses midnight when converted to UTC',
            },
            {
                date: '2024-01-15T10:30:00Z',
                minutes: '30,America/Bogota',
                expected: '2024-01-15T11:00:00.000Z',
                description: 'Z-suffix date ignores timezone param (UTC moment preserved)',
            },
            {
                date: '2024-01-15T10:30:00-05:00',
                minutes: '30,America/Bogota',
                expected: '2024-01-15T16:00:00.000Z',
                description: '-05:00 offset date: explicit offset takes precedence over timezone param',
            },
        ])('should handle timezone-aware mode: $description', async ({ date, minutes, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'addMinutes';

                // Act
                const result = wsFunction.execute(date, minutes);

                // Assert
                expect(result).toBe(expected);
            });
        });

        it('should accept value_static in "number,tz" format (domain validation)', async () => {
            await TenantContext.run(tenant, () => {
                expect(() =>
                    WSRestFunction.create(
                        WSRestFunctionMother.dto({ type: 'addMinutes', value_static: '30,America/Bogota' })
                    )
                ).not.toThrow();
            });
        });

        it('should accept value_static of 0 (domain validation)', async () => {
            await TenantContext.run(tenant, () => {
                expect(() =>
                    WSRestFunction.create(WSRestFunctionMother.dto({ type: 'addMinutes', value_static: 0 }))
                ).not.toThrow();
            });
        });

        it('should throw when value_static is null for addMinutes (domain validation)', async () => {
            await TenantContext.run(tenant, () => {
                expect(() =>
                    WSRestFunction.create(WSRestFunctionMother.dto({ type: 'addMinutes', value_static: null }))
                ).toThrow('value_static must be a valid number for function type "addMinutes"');
            });
        });

        it('should throw when value_static is not a valid number for addMinutes (domain validation)', async () => {
            await TenantContext.run(tenant, () => {
                expect(() =>
                    WSRestFunction.create(WSRestFunctionMother.dto({ type: 'addMinutes', value_static: 'invalid' }))
                ).toThrow('value_static must be a valid number for function type "addMinutes"');
            });
        });
    });

    describe('#addHours', () => {
        it.each([
            {
                date: '2024-01-15T10:00:00Z',
                hours: 2,
                expected: '2024-01-15T12:00:00.000Z',
                description: 'add 2 hours',
            },
            {
                date: '2024-01-15T10:00:00Z',
                hours: 24,
                expected: '2024-01-16T10:00:00.000Z',
                description: 'add 24 hours',
            },
            {
                date: '2024-01-15T23:00:00Z',
                hours: 5,
                expected: '2024-01-16T04:00:00.000Z',
                description: 'add 5 hours crosses midnight',
            },
            {
                date: '2024-01-15T10:00:00Z',
                hours: 0,
                expected: '2024-01-15T10:00:00.000Z',
                description: 'add 0 hours',
            },
            {
                date: '2024-01-15T10:00:00Z',
                hours: -3,
                expected: '2024-01-15T07:00:00.000Z',
                description: 'add negative hours',
            },
            {
                date: '2024-01-15T10:00:00Z',
                hours: '5',
                expected: '2024-01-15T15:00:00.000Z',
                description: 'add string hours',
            },
        ])('should $description', async ({ date, hours, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'addHours';

                // Act
                const result = wsFunction.execute(date, hours);

                // Assert
                expect(result).toBe(expected);
            });
        });

        it.each([
            { date: null, hours: 2, description: 'null date' },
            { date: '2024-01-15T10:00:00Z', hours: 'abc', description: 'invalid hours' },
            { date: 'invalid-date', hours: 2, description: 'invalid date' },
            { date: undefined, hours: 2, description: 'undefined date' },
            { date: '2024-01-15T10:00:00', hours: '2,Invalid/Timezone', description: 'invalid timezone' },
        ])('should throw error for $description', async ({ date, hours }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'addHours';

                // Act & Assert
                expect(() => wsFunction.execute(date, hours)).toThrow(/addHours:/);
            });
        });

        it.each([
            {
                date: '2024-01-15T10:00:00',
                hours: '2,America/Bogota',
                expected: '2024-01-15T17:00:00.000Z',
                description: 'naive date in Bogota (-5) → correct UTC (click API scenario)',
            },
            {
                date: '2024-01-15T10: 00: 00',
                hours: '2,America/Bogota',
                expected: '2024-01-15T17:00:00.000Z',
                description: 'date with spaces in time (external API format) is normalized before parsing',
            },
            {
                date: '2024-01-15T10:00:00Z',
                hours: '2,America/Bogota',
                expected: '2024-01-15T12:00:00.000Z',
                description: 'Z-suffix date ignores timezone param (UTC moment preserved)',
            },
            {
                date: '2024-01-15T10:00:00-05:00',
                hours: '2,America/Bogota',
                expected: '2024-01-15T17:00:00.000Z',
                description: '-05:00 offset date: explicit offset takes precedence over timezone param',
            },
        ])('should handle timezone-aware mode: $description', async ({ date, hours, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'addHours';

                // Act
                const result = wsFunction.execute(date, hours);

                // Assert
                expect(result).toBe(expected);
            });
        });
    });

    describe('#addDays', () => {
        it.each([
            { date: '2024-01-15T10:00:00Z', days: 7, expected: '2024-01-22T10:00:00.000Z', description: 'add 7 days' },
            {
                date: '2024-01-15T10:00:00Z',
                days: 30,
                expected: '2024-02-14T10:00:00.000Z',
                description: 'add 30 days',
            },
            {
                date: '2024-01-31T10:00:00Z',
                days: 1,
                expected: '2024-02-01T10:00:00.000Z',
                description: 'add 1 day crosses month',
            },
            {
                date: '2023-12-31T10:00:00Z',
                days: 1,
                expected: '2024-01-01T10:00:00.000Z',
                description: 'add 1 day crosses year',
            },
            { date: '2024-01-15T10:00:00Z', days: 0, expected: '2024-01-15T10:00:00.000Z', description: 'add 0 days' },
            {
                date: '2024-01-15T10:00:00Z',
                days: -5,
                expected: '2024-01-10T10:00:00.000Z',
                description: 'add negative days',
            },
            {
                date: '2024-01-15T10:00:00Z',
                days: '3',
                expected: '2024-01-18T10:00:00.000Z',
                description: 'add string days',
            },
        ])('should $description', async ({ date, days, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'addDays';

                // Act
                const result = wsFunction.execute(date, days);

                // Assert
                expect(result).toBe(expected);
            });
        });

        it.each([
            { date: null, days: 7, description: 'null date' },
            { date: '2024-01-15T10:00:00Z', days: 'abc', description: 'invalid days' },
            { date: 'invalid-date', days: 7, description: 'invalid date' },
            { date: undefined, days: 7, description: 'undefined date' },
            { date: '2024-01-15T10:00:00', days: '1,Invalid/Timezone', description: 'invalid timezone' },
        ])('should throw error for $description', async ({ date, days }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'addDays';

                // Act & Assert
                expect(() => wsFunction.execute(date, days)).toThrow(/addDays:/);
            });
        });

        it.each([
            {
                date: '2024-01-15T10:00:00',
                days: '1,America/Bogota',
                expected: '2024-01-16T15:00:00.000Z',
                description: 'naive date in Bogota (-5) → correct UTC (click API scenario)',
            },
            {
                date: '2024-01-15T10: 00: 00',
                days: '1,America/Bogota',
                expected: '2024-01-16T15:00:00.000Z',
                description: 'date with spaces in time (external API format) is normalized before parsing',
            },
            {
                date: '2024-01-15T10:00:00Z',
                days: '1,America/Bogota',
                expected: '2024-01-16T10:00:00.000Z',
                description: 'Z-suffix date ignores timezone param (UTC moment preserved)',
            },
            {
                date: '2024-01-15T10:00:00-05:00',
                days: '1,America/Bogota',
                expected: '2024-01-16T15:00:00.000Z',
                description: '-05:00 offset date: explicit offset takes precedence over timezone param',
            },
        ])('should handle timezone-aware mode: $description', async ({ date, days, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'addDays';

                // Act
                const result = wsFunction.execute(date, days);

                // Assert
                expect(result).toBe(expected);
            });
        });
    });

    describe('#subtractMinutes', () => {
        it.each([
            {
                date: '2024-01-15T10:30:00Z',
                minutes: 30,
                expected: '2024-01-15T10:00:00.000Z',
                description: 'subtract 30 minutes',
            },
            {
                date: '2024-01-15T11:30:00Z',
                minutes: 90,
                expected: '2024-01-15T10:00:00.000Z',
                description: 'subtract 90 minutes',
            },
            {
                date: '2024-01-16T00:30:00Z',
                minutes: 60,
                expected: '2024-01-15T23:30:00.000Z',
                description: 'subtract 60 minutes crosses midnight',
            },
            {
                date: '2024-01-15T10:00:00Z',
                minutes: 0,
                expected: '2024-01-15T10:00:00.000Z',
                description: 'subtract 0 minutes',
            },
            {
                date: '2024-01-15T09:30:00Z',
                minutes: -30,
                expected: '2024-01-15T10:00:00.000Z',
                description: 'subtract negative minutes',
            },
            {
                date: '2024-01-15T10:45:00Z',
                minutes: '45',
                expected: '2024-01-15T10:00:00.000Z',
                description: 'subtract string minutes',
            },
        ])('should $description', async ({ date, minutes, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'subtractMinutes';

                // Act
                const result = wsFunction.execute(date, minutes);

                // Assert
                expect(result).toBe(expected);
            });
        });

        it.each([
            { date: null, minutes: 30, description: 'null date' },
            { date: '2024-01-15T10:00:00Z', minutes: 'abc', description: 'invalid minutes' },
            { date: 'invalid-date', minutes: 30, description: 'invalid date' },
            { date: undefined, minutes: 30, description: 'undefined date' },
            { date: '2024-01-15T10:30:00', minutes: '30,Invalid/Timezone', description: 'invalid timezone' },
        ])('should throw error for $description', async ({ date, minutes }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'subtractMinutes';

                // Act & Assert
                expect(() => wsFunction.execute(date, minutes)).toThrow(/subtractMinutes:/);
            });
        });

        it.each([
            {
                date: '2024-01-15T10:30:00',
                minutes: '30,America/Bogota',
                expected: '2024-01-15T15:00:00.000Z',
                description: 'naive date in Bogota (-5) → correct UTC (click API scenario)',
            },
            {
                date: '2024-01-15T10: 30: 00',
                minutes: '30,America/Bogota',
                expected: '2024-01-15T15:00:00.000Z',
                description: 'date with spaces in time (external API format) is normalized before parsing',
            },
            {
                date: '2024-01-15T10:30:00Z',
                minutes: '30,America/Bogota',
                expected: '2024-01-15T10:00:00.000Z',
                description: 'Z-suffix date ignores timezone param (UTC moment preserved)',
            },
            {
                date: '2024-01-15T10:30:00-05:00',
                minutes: '30,America/Bogota',
                expected: '2024-01-15T15:00:00.000Z',
                description: '-05:00 offset date: explicit offset takes precedence over timezone param',
            },
        ])('should handle timezone-aware mode: $description', async ({ date, minutes, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'subtractMinutes';

                // Act
                const result = wsFunction.execute(date, minutes);

                // Assert
                expect(result).toBe(expected);
            });
        });
    });

    describe('#subtractHours', () => {
        it.each([
            {
                date: '2024-01-15T12:00:00Z',
                hours: 2,
                expected: '2024-01-15T10:00:00.000Z',
                description: 'subtract 2 hours',
            },
            {
                date: '2024-01-16T10:00:00Z',
                hours: 24,
                expected: '2024-01-15T10:00:00.000Z',
                description: 'subtract 24 hours',
            },
            {
                date: '2024-01-16T04:00:00Z',
                hours: 5,
                expected: '2024-01-15T23:00:00.000Z',
                description: 'subtract 5 hours crosses midnight',
            },
            {
                date: '2024-01-15T10:00:00Z',
                hours: 0,
                expected: '2024-01-15T10:00:00.000Z',
                description: 'subtract 0 hours',
            },
            {
                date: '2024-01-15T07:00:00Z',
                hours: -3,
                expected: '2024-01-15T10:00:00.000Z',
                description: 'subtract negative hours',
            },
            {
                date: '2024-01-15T15:00:00Z',
                hours: '5',
                expected: '2024-01-15T10:00:00.000Z',
                description: 'subtract string hours',
            },
        ])('should $description', async ({ date, hours, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'subtractHours';

                // Act
                const result = wsFunction.execute(date, hours);

                // Assert
                expect(result).toBe(expected);
            });
        });

        it.each([
            { date: null, hours: 2, description: 'null date' },
            { date: '2024-01-15T10:00:00Z', hours: 'abc', description: 'invalid hours' },
            { date: 'invalid-date', hours: 2, description: 'invalid date' },
            { date: undefined, hours: 2, description: 'undefined date' },
            { date: '2024-01-15T10:00:00', hours: '2,Invalid/Timezone', description: 'invalid timezone' },
        ])('should throw error for $description', async ({ date, hours }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'subtractHours';

                // Act & Assert
                expect(() => wsFunction.execute(date, hours)).toThrow(/subtractHours:/);
            });
        });

        it.each([
            {
                date: '2024-01-15T10:00:00',
                hours: '2,America/Bogota',
                expected: '2024-01-15T13:00:00.000Z',
                description: 'naive date in Bogota (-5) → correct UTC (click API scenario)',
            },
            {
                date: '2024-01-15T10: 00: 00',
                hours: '2,America/Bogota',
                expected: '2024-01-15T13:00:00.000Z',
                description: 'date with spaces in time (external API format) is normalized before parsing',
            },
            {
                date: '2024-01-15T10:00:00Z',
                hours: '2,America/Bogota',
                expected: '2024-01-15T08:00:00.000Z',
                description: 'Z-suffix date ignores timezone param (UTC moment preserved)',
            },
            {
                date: '2024-01-15T10:00:00-05:00',
                hours: '2,America/Bogota',
                expected: '2024-01-15T13:00:00.000Z',
                description: '-05:00 offset date: explicit offset takes precedence over timezone param',
            },
        ])('should handle timezone-aware mode: $description', async ({ date, hours, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'subtractHours';

                // Act
                const result = wsFunction.execute(date, hours);

                // Assert
                expect(result).toBe(expected);
            });
        });
    });

    describe('#subtractDays', () => {
        it.each([
            {
                date: '2024-01-22T10:00:00Z',
                days: 7,
                expected: '2024-01-15T10:00:00.000Z',
                description: 'subtract 7 days',
            },
            {
                date: '2024-02-14T10:00:00Z',
                days: 30,
                expected: '2024-01-15T10:00:00.000Z',
                description: 'subtract 30 days',
            },
            {
                date: '2024-02-01T10:00:00Z',
                days: 1,
                expected: '2024-01-31T10:00:00.000Z',
                description: 'subtract 1 day crosses month',
            },
            {
                date: '2024-01-01T10:00:00Z',
                days: 1,
                expected: '2023-12-31T10:00:00.000Z',
                description: 'subtract 1 day crosses year',
            },
            {
                date: '2024-01-15T10:00:00Z',
                days: 0,
                expected: '2024-01-15T10:00:00.000Z',
                description: 'subtract 0 days',
            },
            {
                date: '2024-01-10T10:00:00Z',
                days: -5,
                expected: '2024-01-15T10:00:00.000Z',
                description: 'subtract negative days',
            },
            {
                date: '2024-01-18T10:00:00Z',
                days: '3',
                expected: '2024-01-15T10:00:00.000Z',
                description: 'subtract string days',
            },
        ])('should $description', async ({ date, days, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'subtractDays';

                // Act
                const result = wsFunction.execute(date, days);

                // Assert
                expect(result).toBe(expected);
            });
        });

        it.each([
            { date: null, days: 7, description: 'null date' },
            { date: '2024-01-15T10:00:00Z', days: 'abc', description: 'invalid days' },
            { date: 'invalid-date', days: 7, description: 'invalid date' },
            { date: undefined, days: 7, description: 'undefined date' },
            { date: '2024-01-15T10:00:00', days: '1,Invalid/Timezone', description: 'invalid timezone' },
        ])('should throw error for $description', async ({ date, days }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'subtractDays';

                // Act & Assert
                expect(() => wsFunction.execute(date, days)).toThrow(/subtractDays:/);
            });
        });

        it.each([
            {
                date: '2024-01-15T10:00:00',
                days: '1,America/Bogota',
                expected: '2024-01-14T15:00:00.000Z',
                description: 'naive date in Bogota (-5) → correct UTC (click API scenario)',
            },
            {
                date: '2024-01-15T10: 00: 00',
                days: '1,America/Bogota',
                expected: '2024-01-14T15:00:00.000Z',
                description: 'date with spaces in time (external API format) is normalized before parsing',
            },
            {
                date: '2024-01-15T10:00:00Z',
                days: '1,America/Bogota',
                expected: '2024-01-14T10:00:00.000Z',
                description: 'Z-suffix date ignores timezone param (UTC moment preserved)',
            },
            {
                date: '2024-01-15T10:00:00-05:00',
                days: '1,America/Bogota',
                expected: '2024-01-14T15:00:00.000Z',
                description: '-05:00 offset date: explicit offset takes precedence over timezone param',
            },
        ])('should handle timezone-aware mode: $description', async ({ date, days, expected }) => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto();
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'subtractDays';

                // Act
                const result = wsFunction.execute(date, days);

                // Assert
                expect(result).toBe(expected);
            });
        });
    });

    describe('#filterArray', () => {
        it('should return first object matching = condition', async () => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const array = [
                    { status: 'Pendiente', id: 1 },
                    { status: 'Pendiente', id: 2 },
                    { status: 'Cerrado', id: 3 },
                ];
                const dto = WSRestFunctionMother.dto({ type: 'filterArray', value_static: 'status=Pendiente' });
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'filterArray';

                // Act
                const result = wsFunction.execute(array, 'status=Pendiente');

                // Assert — only the first match
                expect(result).toEqual({ status: 'Pendiente', id: 1 });
            });
        });

        it('should return first object matching != condition', async () => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const array = [{ status: 'Pendiente' }, { status: 'Cerrado' }];
                const dto = WSRestFunctionMother.dto({ type: 'filterArray', value_static: 'status!=Cerrado' });
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'filterArray';

                // Act
                const result = wsFunction.execute(array, 'status!=Cerrado');

                // Assert
                expect(result).toEqual({ status: 'Pendiente' });
            });
        });

        it('should return null when no items match', async () => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const array = [{ status: 'Cerrado' }];
                const dto = WSRestFunctionMother.dto({ type: 'filterArray', value_static: 'status=Pendiente' });
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'filterArray';

                // Act
                const result = wsFunction.execute(array, 'status=Pendiente');

                // Assert
                expect(result).toBeNull();
            });
        });

        it('should return null for empty input array', async () => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto({ type: 'filterArray', value_static: 'status=Pendiente' });
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'filterArray';

                // Act
                const result = wsFunction.execute([], 'status=Pendiente');

                // Assert
                expect(result).toBeNull();
            });
        });

        it('should accept JSON string as array input', async () => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto({ type: 'filterArray', value_static: 'status=Pendiente' });
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'filterArray';

                // Act
                const result = wsFunction.execute('[{"status":"Pendiente"}]', 'status=Pendiente');

                // Assert
                expect(result).toEqual({ status: 'Pendiente' });
            });
        });

        it('should work with dynamic condition resolved as string (value_dynamic=true)', async () => {
            await TenantContext.run(tenant, () => {
                // Arrange — the condition arrives already resolved as a plain string
                const array = [{ status: 'Pendiente' }, { status: 'Cerrado' }];
                const dto = WSRestFunctionMother.dto({
                    type: 'filterArray',
                    value_static: 'condicion',
                    value_dynamic: true,
                });
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'filterArray';

                // Act — executor resolves value_static to "status=Pendiente" before calling execute
                const resolvedCondition = 'status=Pendiente';
                const result = wsFunction.execute(array, resolvedCondition);

                // Assert
                expect(result).toEqual({ status: 'Pendiente' });
            });
        });

        it('should throw for invalid condition format', async () => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto({ type: 'filterArray', value_static: 'status=Pendiente' });
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'filterArray';

                // Act & Assert
                expect(() => wsFunction.execute([{ status: 'Pendiente' }], 'badcondition')).toThrow(/filterArray:/);
            });
        });

        it('should throw for non-array input', async () => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto({ type: 'filterArray', value_static: 'status=Pendiente' });
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'filterArray';

                // Act & Assert
                expect(() => wsFunction.execute('not-an-array', 'status=x')).toThrow(/filterArray:/);
            });
        });

        it('should throw for null condition', async () => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const dto = WSRestFunctionMother.dto({ type: 'filterArray', value_static: 'status=Pendiente' });
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'filterArray';

                // Act & Assert
                expect(() => wsFunction.execute([{ status: 'Pendiente' }], null)).toThrow(/filterArray:/);
            });
        });

        it('should throw when value_static is null (domain validation)', async () => {
            await TenantContext.run(tenant, () => {
                // Spread to bypass Mother's ?? default which would replace null
                const dto = { ...WSRestFunctionMother.dto({ type: 'filterArray' }), value_static: null };
                expect(() => WSRestFunction.create(dto)).toThrow(/value_static/);
            });
        });

        it('should return first object matching = condition on nested field with dot notation', async () => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const array = [
                    { id: 1, Status: { Key: 124151808, '@DisplayString': 'Aceptado' } },
                    { id: 2, Status: { Key: 124151809, '@DisplayString': 'Cancelado' } },
                ];
                const dto = WSRestFunctionMother.dto({
                    type: 'filterArray',
                    value_static: 'Status.@DisplayString=Aceptado',
                });
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'filterArray';

                // Act
                const result = wsFunction.execute(array, 'Status.@DisplayString=Aceptado');

                // Assert
                expect(result).toEqual({ id: 1, Status: { Key: 124151808, '@DisplayString': 'Aceptado' } });
            });
        });

        it('should return first object matching != condition on nested field with dot notation', async () => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const array = [
                    { id: 1, Status: { '@DisplayString': 'Aceptado' } },
                    { id: 2, Status: { '@DisplayString': 'Cancelado' } },
                ];
                const dto = WSRestFunctionMother.dto({
                    type: 'filterArray',
                    value_static: 'Status.@DisplayString!=Cancelado',
                });
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'filterArray';

                // Act
                const result = wsFunction.execute(array, 'Status.@DisplayString!=Cancelado');

                // Assert
                expect(result).toEqual({ id: 1, Status: { '@DisplayString': 'Aceptado' } });
            });
        });

        it('should return null when nested field does not exist', async () => {
            await TenantContext.run(tenant, () => {
                // Arrange
                const array = [{ id: 1, Status: { Key: 1 } }];
                const dto = WSRestFunctionMother.dto({
                    type: 'filterArray',
                    value_static: 'Status.@DisplayString=Aceptado',
                });
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'filterArray';

                // Act
                const result = wsFunction.execute(array, 'Status.@DisplayString=Aceptado');

                // Assert
                expect(result).toBeNull();
            });
        });

        it('should match items where field equals empty string', async () => {
            await TenantContext.run(tenant, () => {
                const array = [{ status: '' }, { status: 'Activo' }];
                const dto = WSRestFunctionMother.dto({ type: 'filterArray', value_static: 'status=' });
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'filterArray';

                const result = wsFunction.execute(array, 'status=');

                expect(result).toEqual({ status: '' });
            });
        });

        it('should match items where field is not empty string using != condition', async () => {
            await TenantContext.run(tenant, () => {
                const array = [{ status: '' }, { status: 'Activo' }];
                const dto = WSRestFunctionMother.dto({ type: 'filterArray', value_static: 'status!=' });
                const wsFunction = WSRestFunction.create(dto);
                wsFunction.type = 'filterArray';

                const result = wsFunction.execute(array, 'status!=');

                expect(result).toEqual({ status: 'Activo' });
            });
        });
    });

    describe('#filterArrayAll', () => {
        it('should return all objects matching a single = condition', async () => {
            await TenantContext.run(tenant, () => {
                const array = [
                    { status: 'Pendiente', id: 1 },
                    { status: 'Pendiente', id: 2 },
                    { status: 'Cerrado', id: 3 },
                ];
                const dto = WSRestFunctionMother.dto({ type: 'filterArrayAll', value_static: 'status=Pendiente' });
                const wsFunction = WSRestFunction.create(dto);

                const result = wsFunction.execute(array, 'status=Pendiente');

                expect(result).toEqual([
                    { status: 'Pendiente', id: 1 },
                    { status: 'Pendiente', id: 2 },
                ]);
            });
        });

        it('should return all objects matching multiple AND conditions separated by |', async () => {
            await TenantContext.run(tenant, () => {
                const array = [
                    { status: 'Pendiente', priority: 'high', id: 1 },
                    { status: 'Pendiente', priority: 'low', id: 2 },
                    { status: 'Cerrado', priority: 'high', id: 3 },
                ];
                const dto = WSRestFunctionMother.dto({
                    type: 'filterArrayAll',
                    value_static: 'status=Pendiente|priority=high',
                });
                const wsFunction = WSRestFunction.create(dto);

                const result = wsFunction.execute(array, 'status=Pendiente|priority=high');

                expect(result).toEqual([{ status: 'Pendiente', priority: 'high', id: 1 }]);
            });
        });

        it('should return all objects matching != condition', async () => {
            await TenantContext.run(tenant, () => {
                const array = [
                    { status: 'Pendiente', id: 1 },
                    { status: 'Cerrado', id: 2 },
                    { status: 'Activo', id: 3 },
                ];
                const dto = WSRestFunctionMother.dto({
                    type: 'filterArrayAll',
                    value_static: 'status!=Cerrado',
                });
                const wsFunction = WSRestFunction.create(dto);

                const result = wsFunction.execute(array, 'status!=Cerrado');

                expect(result).toEqual([
                    { status: 'Pendiente', id: 1 },
                    { status: 'Activo', id: 3 },
                ]);
            });
        });

        it('should return empty array when no items match', async () => {
            await TenantContext.run(tenant, () => {
                const array = [{ status: 'Cerrado' }];
                const dto = WSRestFunctionMother.dto({ type: 'filterArrayAll', value_static: 'status=Pendiente' });
                const wsFunction = WSRestFunction.create(dto);

                const result = wsFunction.execute(array, 'status=Pendiente');

                expect(result).toEqual([]);
            });
        });

        it('should work with nested field paths', async () => {
            await TenantContext.run(tenant, () => {
                const array = [
                    { id: 1, presenceDefinition: { systemPresence: 'On Queue' } },
                    { id: 2, presenceDefinition: { systemPresence: 'Available' } },
                    { id: 3, presenceDefinition: { systemPresence: 'On Queue' } },
                ];
                const dto = WSRestFunctionMother.dto({
                    type: 'filterArrayAll',
                    value_static: 'presenceDefinition.systemPresence=On Queue',
                });
                const wsFunction = WSRestFunction.create(dto);

                const result = wsFunction.execute(array, 'presenceDefinition.systemPresence=On Queue');

                expect(result).toHaveLength(2);
                expect(result[0].id).toBe(1);
                expect(result[1].id).toBe(3);
            });
        });

        it('should accept JSON string as array input', async () => {
            await TenantContext.run(tenant, () => {
                const dto = WSRestFunctionMother.dto({ type: 'filterArrayAll', value_static: 'status=Pendiente' });
                const wsFunction = WSRestFunction.create(dto);

                const result = wsFunction.execute(
                    '[{"status":"Pendiente","id":1},{"status":"Cerrado","id":2}]',
                    'status=Pendiente'
                );

                expect(result).toEqual([{ status: 'Pendiente', id: 1 }]);
            });
        });

        it('should throw for empty conditions', async () => {
            await TenantContext.run(tenant, () => {
                const dto = WSRestFunctionMother.dto({ type: 'filterArrayAll', value_static: 'x=1' });
                const wsFunction = WSRestFunction.create(dto);

                expect(() => wsFunction.execute([], '')).toThrow(/filterArrayAll:/);
            });
        });

        it('should throw for invalid condition format', async () => {
            await TenantContext.run(tenant, () => {
                const dto = WSRestFunctionMother.dto({ type: 'filterArrayAll', value_static: 'x=1' });
                const wsFunction = WSRestFunction.create(dto);

                expect(() => wsFunction.execute([{ a: 1 }], 'badcondition')).toThrow(/invalid condition format/);
            });
        });

        it('should throw for non-array input', async () => {
            await TenantContext.run(tenant, () => {
                const dto = WSRestFunctionMother.dto({ type: 'filterArrayAll', value_static: 'x=1' });
                const wsFunction = WSRestFunction.create(dto);

                expect(() => wsFunction.execute('not-json', 'x=1')).toThrow(/filterArrayAll:/);
            });
        });
    });

    describe('#filterArrayIn', () => {
        it('should filter targetArray keeping only elements whose field is IN lookupArray', async () => {
            await TenantContext.run(tenant, () => {
                const lookupArray = [{ id: 'abc' }, { id: 'xyz' }];
                const targetArray = [
                    { name: 'Alice', data: { gc_id: 'abc' } },
                    { name: 'Bob', data: { gc_id: 'zzz' } },
                    { name: 'Carol', data: { gc_id: 'xyz' } },
                ];
                const dto = WSRestFunctionMother.dto({
                    type: 'filterArrayIn',
                    value_static: 'id,data.gc_id',
                });
                const wsFunction = WSRestFunction.create(dto);

                const result = wsFunction.execute(lookupArray, targetArray, 'id,data.gc_id');

                expect(result).toEqual([
                    { name: 'Alice', data: { gc_id: 'abc' } },
                    { name: 'Carol', data: { gc_id: 'xyz' } },
                ]);
            });
        });

        it('should work with real-world Genesys presences and users data', async () => {
            await TenantContext.run(tenant, () => {
                const presences = [
                    { id: '02b8eea8-fba5-4ed6-8017-be17f96e4a2c', presenceDefinition: { systemPresence: 'On Queue' } },
                    { id: '6a4b9ceb-d0e7-40f1-a4bb-59257e9d5e99', presenceDefinition: { systemPresence: 'On Queue' } },
                ];
                const users = [
                    { nombres: 'hildefonso', data: { id_de_genesys_cloud: '6a4b9ceb-d0e7-40f1-a4bb-59257e9d5e99' } },
                    { nombres: 'jessica', data: { id_de_genesys_cloud: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' } },
                ];
                const dto = WSRestFunctionMother.dto({
                    type: 'filterArrayIn',
                    value_static: 'id,data.id_de_genesys_cloud',
                });
                const wsFunction = WSRestFunction.create(dto);

                const result = wsFunction.execute(presences, users, 'id,data.id_de_genesys_cloud');

                expect(result).toHaveLength(1);
                expect(result[0].nombres).toBe('hildefonso');
            });
        });

        it('should return empty array when no matches exist', async () => {
            await TenantContext.run(tenant, () => {
                const lookupArray = [{ id: 'abc' }];
                const targetArray = [{ data: { gc_id: 'zzz' } }];
                const dto = WSRestFunctionMother.dto({ type: 'filterArrayIn', value_static: 'id,data.gc_id' });
                const wsFunction = WSRestFunction.create(dto);

                const result = wsFunction.execute(lookupArray, targetArray, 'id,data.gc_id');

                expect(result).toEqual([]);
            });
        });

        it('should return empty array for empty targetArray', async () => {
            await TenantContext.run(tenant, () => {
                const lookupArray = [{ id: 'abc' }];
                const dto = WSRestFunctionMother.dto({ type: 'filterArrayIn', value_static: 'id,data.gc_id' });
                const wsFunction = WSRestFunction.create(dto);

                const result = wsFunction.execute(lookupArray, [], 'id,data.gc_id');

                expect(result).toEqual([]);
            });
        });

        it('should return empty array for empty lookupArray', async () => {
            await TenantContext.run(tenant, () => {
                const targetArray = [{ data: { gc_id: 'abc' } }];
                const dto = WSRestFunctionMother.dto({ type: 'filterArrayIn', value_static: 'id,data.gc_id' });
                const wsFunction = WSRestFunction.create(dto);

                const result = wsFunction.execute([], targetArray, 'id,data.gc_id');

                expect(result).toEqual([]);
            });
        });

        it('should accept JSON strings as array inputs', async () => {
            await TenantContext.run(tenant, () => {
                const dto = WSRestFunctionMother.dto({ type: 'filterArrayIn', value_static: 'id,ref' });
                const wsFunction = WSRestFunction.create(dto);

                const result = wsFunction.execute(
                    '[{"id":"a"},{"id":"b"}]',
                    '[{"ref":"a","name":"X"},{"ref":"c","name":"Y"}]',
                    'id,ref'
                );

                expect(result).toEqual([{ ref: 'a', name: 'X' }]);
            });
        });

        it('should work with top-level fields (no dot notation)', async () => {
            await TenantContext.run(tenant, () => {
                const lookupArray = [{ code: '100' }, { code: '200' }];
                const targetArray = [
                    { ref_code: '100', name: 'A' },
                    { ref_code: '300', name: 'B' },
                ];
                const dto = WSRestFunctionMother.dto({ type: 'filterArrayIn', value_static: 'code,ref_code' });
                const wsFunction = WSRestFunction.create(dto);

                const result = wsFunction.execute(lookupArray, targetArray, 'code,ref_code');

                expect(result).toEqual([{ ref_code: '100', name: 'A' }]);
            });
        });

        it('should return empty array when lookupArray is null', async () => {
            await TenantContext.run(tenant, () => {
                const targetArray = [{ ref_code: '100', name: 'A' }];
                const dto = WSRestFunctionMother.dto({ type: 'filterArrayIn', value_static: 'code,ref_code' });
                const wsFunction = WSRestFunction.create(dto);

                const result = wsFunction.execute(null, targetArray, 'code,ref_code');

                expect(result).toEqual([]);
            });
        });

        it('should return empty array when targetArray is null', async () => {
            await TenantContext.run(tenant, () => {
                const lookupArray = [{ code: '100' }];
                const dto = WSRestFunctionMother.dto({ type: 'filterArrayIn', value_static: 'code,ref_code' });
                const wsFunction = WSRestFunction.create(dto);

                const result = wsFunction.execute(lookupArray, null, 'code,ref_code');

                expect(result).toEqual([]);
            });
        });

        it('should skip null/undefined values in lookup set', async () => {
            await TenantContext.run(tenant, () => {
                const lookupArray = [{ id: null }, { id: 'abc' }, { id: undefined }];
                const targetArray = [
                    { ref: 'abc', name: 'match' },
                    { ref: null, name: 'no match' },
                ];
                const dto = WSRestFunctionMother.dto({ type: 'filterArrayIn', value_static: 'id,ref' });
                const wsFunction = WSRestFunction.create(dto);

                const result = wsFunction.execute(lookupArray, targetArray, 'id,ref');

                expect(result).toEqual([{ ref: 'abc', name: 'match' }]);
            });
        });

        it('should throw for invalid config format', async () => {
            await TenantContext.run(tenant, () => {
                const dto = WSRestFunctionMother.dto({ type: 'filterArrayIn', value_static: 'id,ref' });
                const wsFunction = WSRestFunction.create(dto);

                // Use non-empty arrays so config validation is reached (empty arrays short-circuit to [])
                expect(() => wsFunction.execute([{ id: 1 }], [{ ref: 1 }], 'only-one-field')).toThrow(
                    /filterArrayIn.*Expected/
                );
            });
        });

        it('should throw for empty config', async () => {
            await TenantContext.run(tenant, () => {
                const dto = WSRestFunctionMother.dto({ type: 'filterArrayIn', value_static: 'id,ref' });
                const wsFunction = WSRestFunction.create(dto);

                expect(() => wsFunction.execute([], [], '')).toThrow(/filterArrayIn:/);
            });
        });

        it('should throw for non-array lookupArray', async () => {
            await TenantContext.run(tenant, () => {
                const dto = WSRestFunctionMother.dto({ type: 'filterArrayIn', value_static: 'id,ref' });
                const wsFunction = WSRestFunction.create(dto);

                expect(() => wsFunction.execute('not-json', [], 'id,ref')).toThrow(/filterArrayIn:/);
            });
        });

        it('should throw for non-array targetArray', async () => {
            await TenantContext.run(tenant, () => {
                const dto = WSRestFunctionMother.dto({ type: 'filterArrayIn', value_static: 'id,ref' });
                const wsFunction = WSRestFunction.create(dto);

                expect(() => wsFunction.execute([], 'not-json', 'id,ref')).toThrow(/filterArrayIn:/);
            });
        });

        it('should throw when value_static is null (domain validation)', async () => {
            await TenantContext.run(tenant, () => {
                const dto = { ...WSRestFunctionMother.dto({ type: 'filterArrayIn' }), value_static: null };
                expect(() => WSRestFunction.create(dto)).toThrow(/value_static/);
            });
        });
    });
});
