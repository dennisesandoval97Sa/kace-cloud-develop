import { S3CreatePresignedUrl } from '../../../src/shared/infrastructure/aws/S3CreatePresignedUrl.js';
import { InvalidFileExtensionError } from '../../../src/shared/infrastructure/aws/errors/InvalidFileExtensionError.js';

describe('S3CreatePresignedUrl - File Extension Validation', () => {
    let mockS3Client;

    beforeEach(() => {
        mockS3Client = {};
    });

    describe('Extensiones válidas', () => {
        test('should accept CSV files', () => {
            const command = { input: { Key: 'archivo.csv' } };
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
        });

        test('should accept Excel .xls files', () => {
            const command = { input: { Key: 'archivo.xls' } };
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
        });

        test('should accept Excel .xlsx files', () => {
            const command = { input: { Key: 'archivo.xlsx' } };
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
        });

        test('should accept text files', () => {
            const command = { input: { Key: 'archivo.txt' } };
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
        });

        test('should accept PDF files', () => {
            const command = { input: { Key: 'documento.pdf' } };
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
        });

        test('should accept JPG images', () => {
            const command = { input: { Key: 'imagen.jpg' } };
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
        });

        test('should accept JPEG images', () => {
            const command = { input: { Key: 'imagen.jpeg' } };
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
        });

        test('should accept PNG images', () => {
            const command = { input: { Key: 'imagen.png' } };
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
        });

        test('should accept GIF images', () => {
            const command = { input: { Key: 'imagen.gif' } };
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
        });

        test('should accept SVG images', () => {
            const command = { input: { Key: 'imagen.svg' } };
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
        });

        test('should accept PPT images', () => {
            const command = { input: { Key: 'imagen.ppt' } };
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
        });

        test('should accept PPTX images', () => {
            const command = { input: { Key: 'imagen.pptx' } };
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
        });

        test('should accept ZIP images', () => {
            const command = { input: { Key: 'imagen.zip' } };
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
        });

        test('should accept RAR images', () => {
            const command = { input: { Key: 'imagen.rar' } };
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
        });

        test('should accept DOC images', () => {
            const command = { input: { Key: 'imagen.doc' } };
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
        });

        test('should accept DOCX images', () => {
            const command = { input: { Key: 'imagen.docx' } };
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
        });

        test('should accept files with uppercase extensions', () => {
            const command = { input: { Key: 'ARCHIVO.CSV' } };
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
        });

        test('should accept files with mixed case extensions', () => {
            const command = { input: { Key: 'Archivo.PdF' } };
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
        });

        test('should accept files with path', () => {
            const command = { input: { Key: 'carpeta/subcarpeta/archivo.csv' } };
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
        });

        test('should accept MP4 video files', () => {
            const command = { input: { Key: 'video.mp4' } };
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
        });

        test.each(['.mov', '.mp3', '.bmp', '.md', '.heic'])(
            'should accept %s files from shared catalog',
            (extension) => {
                const command = { input: { Key: `file${extension}` } };
                expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
            }
        );
    });

    describe('Extensiones inválidas', () => {
        test('should reject .exe files', () => {
            const command = { input: { Key: 'malware.exe' } };
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).toThrow(InvalidFileExtensionError);
        });

        test('should reject files without extension', () => {
            const command = { input: { Key: 'archivo_sin_extension' } };
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).toThrow(InvalidFileExtensionError);
        });

        test('should include filename in error message', () => {
            const fileName = 'archivo.exe';
            const command = { input: { Key: fileName } };

            try {
                new S3CreatePresignedUrl(mockS3Client, command);
                fail('Should have thrown InvalidFileExtensionError');
            } catch (error) {
                expect(error).toBeInstanceOf(InvalidFileExtensionError);
                expect(error.message).toContain(fileName);
                expect(error.fileName).toBe(fileName);
                expect(error.extension).toBe('.exe');
            }
        });

        test('should include allowed extensions in error message', () => {
            const command = { input: { Key: 'archivo.exe' } };

            try {
                new S3CreatePresignedUrl(mockS3Client, command);
                fail('Should have thrown InvalidFileExtensionError');
            } catch (error) {
                expect(error).toBeInstanceOf(InvalidFileExtensionError);
                expect(error.message).toContain('.csv');
                expect(error.message).toContain('.pdf');
                expect(error.message).toContain('.jpg');
            }
        });
    });

    describe('Casos edge', () => {
        test('should not throw when command is undefined', () => {
            expect(() => new S3CreatePresignedUrl(mockS3Client, undefined)).not.toThrow();
        });

        test('should not throw when command.input is undefined', () => {
            const command = {};
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
        });

        test('should not throw when command.input.Key is undefined', () => {
            const command = { input: {} };
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
        });

        test('should handle files with multiple dots in name', () => {
            const command = { input: { Key: 'archivo.backup.csv' } };
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
        });

        test('should handle files starting with dot', () => {
            const command = { input: { Key: '.hidden.csv' } };
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
        });
    });
});
