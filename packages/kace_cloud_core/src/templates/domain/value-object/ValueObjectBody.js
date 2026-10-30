import { ValueObjectString } from '../../../shared';
import { HtmlTemplateSanitizer } from '../../../shared/domain/security/HtmlTemplateSanitizer.js';

export class ValueObjectBody extends ValueObjectString {
    constructor(field, value, nullable = false) {
        const sanitized = typeof value === 'string' ? HtmlTemplateSanitizer.sanitize(value) : value;

        /*
         * The keyword-blocklist XSSGuard (shared by every ValueObjectString) false-positives on
         * HTML that HtmlTemplateSanitizer has already made safe - e.g. legitimate escaped entities
         * like `&lt;`/`&gt;` trip its bare-word list. Skip it here: structural sanitization above is
         * strictly more correct for HTML bodies than a substring blocklist.
         *
         * Same reasoning for SQLInjectionGuard: it blocklists standalone SQL keywords (select,
         * update, insert, drop...), which are ordinary English words that legitimately show up in
         * template prose ("select an option", "we'll update your case"). This field is never
         * interpolated into raw SQL - persistence goes through parameterized Knex queries - so the
         * keyword blocklist adds no real protection here, only false positives.
         */
        super(field, sanitized, nullable, 100000, true, true);
    }
}
