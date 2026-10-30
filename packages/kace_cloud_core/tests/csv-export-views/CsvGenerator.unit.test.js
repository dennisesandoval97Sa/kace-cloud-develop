import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ValueObjectCsvFormatting } from '../../src/csv-export-views/domain/value-objects/ValueObjectCsvFormatting';
import { CsvGenerator } from '../../src/csv-export-views';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const it_DIR = join(__dirname, 'tmp');
if (!fs.existsSync(it_DIR)) {
    fs.mkdirSync(it_DIR, { recursive: true });
}

describe('CsvGenerator', () => {
    const itData = [
        { id: 1, name: 'John Doe', email: 'john@example.com', active: true },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', active: false },
        { id: 3, name: 'Bob Johnson', email: 'bob@example.com', active: true },
    ];

    afterEach(() => {
        const files = fs.readdirSync(it_DIR);
        files.forEach((file) => {
            if (file.endsWith('.csv')) {
                fs.unlinkSync(join(it_DIR, file));
            }
        });
    });

    afterAll(() => {
        if (fs.existsSync(it_DIR)) {
            fs.rmSync(it_DIR, { recursive: true, force: true });
        }
    });

    describe('Constructors and configuration', () => {
        it('Should initialize with default values', () => {
            const generator = new CsvGenerator();
            const config = generator.getConfig();

            expect(config).toEqual(ValueObjectCsvFormatting.DEFAULT_VALUES);
        });

        it('Should accept custom options in the constructor', () => {
            const generator = new CsvGenerator({
                separator: ',',
                valueQuotes: false,
                nullValue: 'N/A',
            });

            const config = generator.getConfig();

            expect(config.separator).toBe(',');
            expect(config.valueQuotes).toBe(false);
            expect(config.nullValue).toBe('N/A');
            expect(config.includeHeader).toBe(true);
        });

        it('Should update configuration with setOptions', () => {
            const generator = new CsvGenerator();
            generator.setOptions({ separator: ',', nullValue: 'NULL' });

            const config = generator.getConfig();

            expect(config.separator).toBe(',');
            expect(config.nullValue).toBe('NULL');
        });

        it('setOptions should allow chaining', () => {
            const generator = new CsvGenerator();
            const result = generator.setOptions({ separator: ',' });

            expect(result).toBe(generator);
        });

        it('setOptions falls back to the default formatting values when called without arguments', () => {
            const generator = new CsvGenerator({ separator: ';', nullValue: 'N/A' });

            generator.setOptions();

            expect(generator.getConfig()).toEqual(ValueObjectCsvFormatting.DEFAULT_VALUES);
        });
    });

    describe('CSV generation as string', () => {
        it('Should correctly generate a basic CSV', () => {
            const generator = new CsvGenerator();
            const csv = generator.generateCsvContent(itData);

            const lines = csv.split('\n');
            expect(lines.length).toBe(4);

            expect(lines[0]).toBe('"id","name","email","active"');
        });

        it('Should respect custom separator option', () => {
            const generator = new CsvGenerator({ separator: ',' });
            const csv = generator.generateCsvContent(itData);

            const lines = csv.split('\n');
            expect(lines[0]).toBe('"id","name","email","active"');
        });

        it('Should respect option to exclude header', () => {
            const generator = new CsvGenerator({ includeHeader: false });
            const csv = generator.generateCsvContent(itData);

            const lines = csv.split('\n');
            expect(lines.length).toBe(3);
            expect(lines[0]).not.toBe('"id";"name";"email";"active"');
        });

        it('Should respect option to not use quotes for values', () => {
            const generator = new CsvGenerator({ valueQuotes: false });
            const csv = generator.generateCsvContent(itData);

            const lines = csv.split('\n');
            expect(lines[0]).toBe('"id","name","email","active"');
            expect(lines[1]).toBe('1,John Doe,john@example.com,true');
        });

        it('Should respect option to not quote headers', () => {
            const generator = new CsvGenerator({ headerQuotes: false });
            const csv = generator.generateCsvContent(itData);

            const lines = csv.split('\n');
            expect(lines[0]).toBe('id,name,email,active');
            expect(lines[1]).toBe('"1","John Doe","john@example.com","true"');
        });

        it('Should use custom line terminator', () => {
            const generator = new CsvGenerator({ lineTerminator: '\r\n' });
            const csv = generator.generateCsvContent(itData);

            const lines = csv.split('\r\n');
            expect(lines.length).toBe(4);
        });

        it('Should handle null and undefined values properly', () => {
            const dataWithNulls = [
                { id: 1, name: 'John', email: null, active: true },
                { id: 2, name: undefined, email: 'jane@example.com', active: false },
            ];

            const generator = new CsvGenerator({ nullValue: 'N/A' });
            const csv = generator.generateCsvContent(dataWithNulls);

            const lines = csv.split('\n');
            expect(lines[1]).toContain('N/A');
            expect(lines[2]).toContain('N/A');
        });

        it('Should return empty string for empty data', () => {
            const generator = new CsvGenerator();
            const csv = generator.generateCsvContent([]);

            expect(csv).toBe('');
        });
    });

    describe('Handling of special characters', () => {
        it('Should escape double quotes in values', () => {
            const dataWithQuotes = [{ id: 1, name: 'John "Johnny" Doe', comment: 'He said "Hello!"' }];

            const generator = new CsvGenerator();
            const csv = generator.generateCsvContent(dataWithQuotes);

            const lines = csv.split('\n');
            expect(lines[1]).toContain('John ""Johnny"" Doe');
            expect(lines[1]).toContain('He said ""Hello!""');
        });

        it('Should handle values containing separator character', () => {
            const dataWithSeparator = [{ id: 1, name: 'John;Doe', email: 'john@example.com' }];

            const generator = new CsvGenerator();
            const csv = generator.generateCsvContent(dataWithSeparator);

            const lines = csv.split('\n');
            expect(lines[1]).toContain('"John;Doe"');
        });

        it('Should handle values with newline characters', () => {
            const dataWithNewlines = [{ id: 1, name: 'John\nDoe', email: 'john@example.com' }];

            const generator = new CsvGenerator();
            const csv = generator.generateCsvContent(dataWithNewlines);

            expect(csv).toContain('"John\nDoe"');
        });

        it('Should handle values with carriage returns', () => {
            const dataWithCarriageReturns = [{ id: 1, name: 'John\rDoe', email: 'john@example.com' }];

            const generator = new CsvGenerator();
            const csv = generator.generateCsvContent(dataWithCarriageReturns);

            expect(csv).toContain('"John\rDoe"');
        });

        it('Should quote a header that itself contains the separator character', () => {
            const dataWithSpecialHeader = [{ 'weird,header': 'value' }];

            const generator = new CsvGenerator();
            const csv = generator.generateCsvContent(dataWithSpecialHeader);

            const lines = csv.split('\n');
            expect(lines[0]).toBe('"weird,header"');
        });
    });

    describe('File generation', () => {
        it('Should generate a CSV file correctly', () => {
            const generator = new CsvGenerator();
            const filePath = generator.generate(itData, 'it-file', it_DIR);

            expect(fs.existsSync(filePath)).toBe(true);

            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const lines = fileContent.split('\n');
            expect(lines.length).toBe(4);
        });

        it('Should generate an empty file for empty data', () => {
            const generator = new CsvGenerator();
            const filePath = generator.generate([], 'empty-file', it_DIR);

            expect(fs.existsSync(filePath)).toBe(true);

            const fileContent = fs.readFileSync(filePath, 'utf-8');
            expect(fileContent).toBe('');
        });

        it('Should use the specified encoding', () => {
            const generator = new CsvGenerator({ encoding: 'utf8' });
            const filePath = generator.generate(itData, 'encoded-file', it_DIR);

            expect(fs.existsSync(filePath)).toBe(true);

            const fileContent = fs.readFileSync(filePath, 'utf8');
            expect(fileContent.length).toBeGreaterThan(0);
        });
    });

    describe('Error handling', () => {
        it('Should throw error if filename is invalid', () => {
            const generator = new CsvGenerator();
            expect(() => {
                generator.generate(itData, '');
            }).toThrow('"Filename" is required');
        });

        it('Should handle write errors', () => {
            const generator = new CsvGenerator();
            const invalidDir = '/root/no-permissions-dir';

            expect(() => {
                generator.generate(itData, 'it-file', invalidDir);
            }).toThrow();
        });

        it('Should stringify a non-Error value thrown by the filesystem write', () => {
            const generator = new CsvGenerator();
            jest.spyOn(fs, 'writeFileSync').mockImplementationOnce(() => {
                throw 'disk is full';
            });

            expect(() => {
                generator.generate(itData, 'it-file', it_DIR);
            }).toThrow('No se pudo escribir el archivo CSV: disk is full');

            jest.restoreAllMocks();
        });
    });
});
