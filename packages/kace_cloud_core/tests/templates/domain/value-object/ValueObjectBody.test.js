import { ValueObjectBody } from '../../../../src/templates/domain/value-object/ValueObjectBody.js';

describe('ValueObjectBody', () => {
    it('keeps plain-text bodies unchanged (backward compatibility)', () => {
        const value = 'Estimado cliente, su caso ha sido actualizado.';
        expect(new ValueObjectBody('cuerpo', value).value).toBe(value);
    });

    it('keeps already-clean HTML bodies unchanged', () => {
        const value = '<p>Hola <strong>mundo</strong></p><table><tr><td>Cell</td></tr></table>';
        expect(new ValueObjectBody('cuerpo', value).value).toBe(value);
    });

    it('silently strips <script> tags instead of rejecting the whole body', () => {
        const value = '<p>Hola</p><script>alert(1)</script>';
        expect(new ValueObjectBody('cuerpo', value).value).toBe('<p>Hola</p>');
    });

    it('silently strips on* event handlers instead of rejecting the whole body', () => {
        const value = '<p onclick="alert(1)">Hola</p>';
        const sanitized = new ValueObjectBody('cuerpo', value).value;
        expect(sanitized).not.toContain('onclick');
        expect(sanitized).toContain('Hola');
    });

    it('preserves template-attachment:// image placeholders used by the inline image embedder', () => {
        const value = '<img src="template-attachment://logo.png" data-filename="logo.png" data-mime="image/png">';
        expect(new ValueObjectBody('cuerpo', value).value).toContain('template-attachment://logo.png');
    });

    it('accepts HTML bodies well beyond the base ValueObjectString 30000-char cap, up to 100000', () => {
        const value = `<p>${'a'.repeat(50000)}</p>`;
        expect(new ValueObjectBody('cuerpo', value).value.length).toBeGreaterThan(30000);
    });

    it('rejects bodies over the 100000-char limit', () => {
        const value = `<p>${'a'.repeat(100001)}</p>`;
        expect(() => new ValueObjectBody('cuerpo', value)).toThrow();
    });

    it('allows a nullable empty body', () => {
        expect(new ValueObjectBody('cuerpo', null, true).value).toBeNull();
    });

    it('accepts bodies containing literal escaped angle brackets (regression: XSSGuard false-positive on &lt;/&gt;)', () => {
        /*
         * A user pasting a code sample like "<table>...</table>" as plain text into the editor
         * produces exported HTML with literal `&lt;`/`&gt;` entities. The bare-word XSSGuard
         * blocklist used to flag "&lt"/"&gt" as prohibited tokens (they're in XSSDictionary's
         * list), rejecting perfectly safe, already-sanitized text with a 500 in staging.
         */
        const value = '<p>Ejemplo: &lt;table&gt;...&lt;/table&gt;</p>';
        expect(() => new ValueObjectBody('cuerpo', value)).not.toThrow();
    });

    it('accepts prose containing standalone SQL keywords (regression: SQLInjectionGuard false-positive on ordinary words)', () => {
        /*
         * "select", "update", "insert", "drop"... are ordinary English words that can
         * legitimately appear in template text. This field is never interpolated into raw SQL
         * (Knex parameterized queries), so the SQL keyword blocklist has no security value here
         * and must not reject legitimate bodies.
         */
        const value = '<p>Please select an option and we will update your case shortly.</p>';
        expect(() => new ValueObjectBody('cuerpo', value)).not.toThrow();
    });
});
