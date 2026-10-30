import { jest } from '@jest/globals';
import { S3FileScanner } from '../../src/s3-files/application/scan/S3FileScanner.js';

describe('S3FileScanner public scan contract', () => {
    it('identifies an encrypted PDF that the scanner cannot inspect', async () => {
        const dto = {
            url: 'attachments',
            id: 'email-id',
            fileName: '08FalloTutela2026-0925-ConcedePeticion.pdf',
        };
        const scanService = {
            scanFile: jest.fn().mockResolvedValue({
                result: 'Error',
                message: 'Standard security handler, AES-256 encrypted PDF',
            }),
            deleteFile: jest.fn().mockResolvedValue(),
        };
        const fileScanner = new S3FileScanner(scanService);

        const result = await fileScanner.execute(dto);

        expect(result).toEqual({
            code: 'attachment_encrypted',
            message: 'Attachment cannot be scanned: encrypted PDF',
            errors: { fileName: dto.fileName },
        });
        expect(scanService.deleteFile).toHaveBeenCalledWith(
            'attachments/email-id/08FalloTutela2026-0925-ConcedePeticion.pdf'
        );
    });

    it('preserves an encrypted-PDF classification returned as a scanner service error', async () => {
        const dto = {
            url: 'attachments',
            id: 'email-id',
            fileName: 'encrypted.pdf',
        };
        const scanError = new Error('Attachment cannot be scanned: encrypted PDF');
        scanError.code = 'attachment_encrypted';
        const scanService = {
            scanFile: jest.fn().mockRejectedValue(scanError),
            deleteFile: jest.fn().mockResolvedValue(),
        };
        const fileScanner = new S3FileScanner(scanService);

        await expect(fileScanner.execute(dto)).resolves.toEqual({
            code: 'attachment_encrypted',
            message: 'Attachment cannot be scanned: encrypted PDF',
            errors: { fileName: dto.fileName },
        });
        expect(scanService.deleteFile).toHaveBeenCalledWith('attachments/email-id/encrypted.pdf');
    });

    it('does not classify a clean PDF as encrypted from descriptive metadata alone', async () => {
        const dto = {
            url: 'attachments',
            id: 'email-id',
            fileName: 'clean.pdf',
        };
        const scanService = {
            scanFile: jest.fn().mockResolvedValue({
                result: 'Clean',
                message: 'Clean PDF; AES-256 metadata supported',
            }),
            deleteFile: jest.fn().mockResolvedValue(),
        };
        const fileScanner = new S3FileScanner(scanService);

        await expect(fileScanner.execute(dto)).resolves.toEqual({
            message: 'File validated successfully',
        });
        expect(scanService.deleteFile).not.toHaveBeenCalled();
    });

    it.each(['Infected', 'Suspicious'])(
        'preserves an explicit %s malware verdict even when the PDF metadata mentions encryption',
        async (verdict) => {
            const dto = {
                url: 'attachments',
                id: 'email-id',
                fileName: 'malicious.pdf',
            };
            const scanService = {
                scanFile: jest.fn().mockResolvedValue({
                    result: verdict,
                    message: 'Encrypted PDF contains malware',
                }),
                deleteFile: jest.fn().mockResolvedValue(),
            };
            const fileScanner = new S3FileScanner(scanService);

            await expect(fileScanner.execute(dto)).resolves.toEqual({
                message: 'Threat detected',
                errors: {
                    fileName: dto.fileName,
                    message: `The attachment ${dto.fileName} is insecure and has been deleted`,
                },
            });
            expect(scanService.deleteFile).toHaveBeenCalledWith('attachments/email-id/malicious.pdf');
        }
    );
});
