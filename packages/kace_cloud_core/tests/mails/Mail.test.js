import { v4 as uuidv4 } from 'uuid';
import { Mail } from '../../src/mails/domain/Mail.js';

const baseDto = {
    id: uuidv4(),
    mail_account_id: uuidv4(),
    to: ['dest@example.com'],
    created_at: new Date(),
    created_by: uuidv4(),
};

describe('Mail', () => {
    it('accepts rendered HTML content containing literal escaped angle brackets (regression: XSSGuard false-positive on &lt;/&gt;)', () => {
        /*
         * A Template body where the user typed "<h1>Hola mundo</h1>" as plain text in the
         * RichEditor gets HTML-escaped on save, so replaceTemplateVariables() renders content
         * like this. The bare-word XSSGuard blocklist used to flag "&lt"/"&gt" as prohibited
         * tokens, so SendEmail's catch-all try/catch silently swallowed the error and the mail
         * was marked "failed" with no message ever surfacing to the user.
         */
        const content = '<p class="mb-1" dir="ltr"><span>&lt;h1&gt;Hola mundo &lt;/h&gt;</span></p>';

        expect(() => Mail.create({ ...baseDto, content })).not.toThrow();
        expect(Mail.create({ ...baseDto, content }).content.value).toContain('&lt;h1&gt;Hola mundo');
    });

    it('strips genuinely dangerous markup from content instead of rejecting the whole mail', () => {
        const content = '<p>Hola</p><script>alert(1)</script>';

        const mail = Mail.create({ ...baseDto, content });

        expect(mail.content.value).not.toContain('<script>');
        expect(mail.content.value).toContain('Hola');
    });

    it('keeps plain-text content unchanged', () => {
        const content = 'Hola mundo';

        expect(Mail.create({ ...baseDto, content }).content.value).toBe(content);
    });
});
