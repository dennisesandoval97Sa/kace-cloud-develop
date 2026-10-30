import { MailAccount } from '../../../src/mail-accounts/index.js';
import MailAccountMother from '../../mail-accounts/domain/MailAccountMother.js';
import { emailConfig } from './domain/gmailConfig.js';
import { GmailClientService } from '../../../src/mails/index.js';

describe('GmailClientService MIME structure', () => {
    async function buildService() {
        const mailAccount = await MailAccount.create({
            ...MailAccountMother.dto(),
            type: 'gmail_user',
            ...emailConfig,
        });
        return new GmailClientService(mailAccount);
    }

    it('does not leave a blank line before the header block ends when Cc/Bcc are empty (no attachments)', async () => {
        const service = await buildService();

        const mime = service.createEmailMessage(['customer@example.com'], 'Subject', '<p>Body</p>', [], []);

        const lines = mime.split('\r\n');
        const subjectIndex = lines.findIndex((line) => line.startsWith('Subject:'));
        const bodySeparatorIndex = lines.indexOf('');

        expect(subjectIndex).toBeGreaterThan(-1);
        // La primera línea en blanco debe aparecer DESPUÉS del Subject (separando headers
        // de cuerpo), nunca antes: una línea en blanco antes del Subject termina la
        // sección de headers según RFC 5322 y deja Subject/Content-Type como parte del
        // cuerpo (repro real: Gmail mostrando "(sin asunto)" con los headers como texto crudo).
        expect(bodySeparatorIndex).toBe(subjectIndex + 1);
        expect(lines).toContain('Content-Type: text/html; charset=utf-8');
        expect(lines).toContain('Subject: =?utf-8?B?U3ViamVjdA==?=');
    });

    it('does not leave a blank line before the header block ends when Cc/Bcc are empty (with attachments)', async () => {
        const service = await buildService();

        const mime = service.createEmailMessage(
            ['customer@example.com'],
            'Subject',
            '<p>Body</p>',
            [],
            [],
            [{ filename: 'case-file.txt', contentType: 'text/plain', content: Buffer.from('case content') }]
        );

        const lines = mime.split('\r\n');
        const contentTypeIndex = lines.findIndex((line) => line.startsWith('Content-Type: multipart/mixed'));
        const firstBoundaryIndex = lines.findIndex((line) => line.startsWith('--kace-boundary-'));

        expect(contentTypeIndex).toBeGreaterThan(-1);
        // El separador headers/cuerpo debe existir justo antes del primer boundary
        // (nunca antes, por el hueco de Cc/Bcc ausentes).
        expect(lines[contentTypeIndex + 1]).toBe('');
        expect(firstBoundaryIndex).toBe(contentTypeIndex + 2);
    });

    it('includes Cc/Bcc headers without introducing extra blank lines when present', async () => {
        const service = await buildService();

        const mime = service.createEmailMessage(
            ['customer@example.com'],
            'Subject',
            '<p>Body</p>',
            ['cc@example.com'],
            ['bcc@example.com']
        );

        const lines = mime.split('\r\n');
        const subjectIndex = lines.findIndex((line) => line.startsWith('Subject:'));

        expect(lines).toContain('Cc: cc@example.com');
        expect(lines).toContain('Bcc: bcc@example.com');
        expect(lines.indexOf('')).toBe(subjectIndex + 1);
    });

    it('sanitizes a malicious attachment contentType to prevent MIME header injection', async () => {
        const service = await buildService();

        const mime = service.createEmailMessage(
            ['customer@example.com'],
            'Subject',
            '<p>Body</p>',
            [],
            [],
            [
                {
                    filename: 'case-file.txt',
                    contentType: 'text/plain"\r\nBcc: attacker@evil.com\r\nX-Injected: true',
                    content: Buffer.from('case content'),
                },
            ]
        );

        // El regex de #escapeMimeParameter sustituye cada comilla/CR/LF por un '_' individual
        // (no colapsa varios caracteres en uno), por eso aparecen 3 y 2 guiones bajos seguidos.
        expect(mime).not.toContain('\r\nBcc: attacker@evil.com');
        expect(mime).not.toContain('\r\nX-Injected: true');
        expect(mime).toContain(
            'Content-Type: text/plain___Bcc: attacker@evil.com__X-Injected: true; name="case-file.txt"'
        );
    });
});
