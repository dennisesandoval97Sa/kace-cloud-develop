export class RegexPatterns {
    static extendedCharactersRegex() {
        return /^[a-zA-ZÀ-ž0-9\s#&()%._\-@'‘’:{};,~“‰\/\\|+¿?¡!*[\]]*$/;
    }

    /** Mirrors @kace/core ValueObjectExternalCode (extendedCharactersRegex, max 100). */
    static externalCodeRegex() {
        return /^[a-zA-ZÀ-ž0-9\s#&()%.\-_@'‘’:;,~“‰\/\\|+¿?¡!*[\]]*$/;
    }

    /*
     * Used for rich-text HTML bodies (Templates cuerpo, Comments/Helps/Case descriptions),
     * all of which are edited via the Lexical RichEditor. Actual content safety is enforced
     * elsewhere - HtmlTemplateSanitizer's tag/attribute allowlist for Templates, DOMPurify for
     * the editor preview, and the XSSGuard keyword blocklist for the others - not by this
     * character list, so it only needs to reject control characters (possible sign of
     * malformed/binary input), not legitimate content like emoji or uncommon symbols that a
     * narrower enumerated whitelist would otherwise block. Mirrors the backend copy in
     * packages/kace_cloud_core/src/shared/domain/regex/RegexPatterns.js - keep both in sync.
     */
    static extendedHtmlRegex() {
        // eslint-disable-next-line no-control-regex -- intentional: this pattern's job is precisely to reject control characters
        return /^[^\x00-\x08\x0B\x0C\x0E-\x1F\x7F]*$/u;
    }

    static clientNameRegex() {
        return /^[a-zA-ZÀ-ž\s#&()%._\-@‘:;,~“‰/\\|]*$/;
    }

    static businessNameRegex() {
        return /^[a-zA-ZÀ-ž\s#&()%._\-@‘:;,~“‰/\\|]*$/;
    }

    static onlyLetters() {
        return /^[a-zA-ZÀ-ÿ ]+$/;
    }

    static descriptionRegex() {
        return /^[a-zA-ZÀ-ÿ0-9\s.,!?-]+$/;
    }

    static descriptionTextAreaRegex() {
        return /^[a-zA-ZÀ-ÿ0-9\s.,!?<>"'/=\-:;()]+$/;
    }

    static colorRegex() {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    }

    static referenceSecretRegex() {
        return /^[A-Z0-9_-]+$/;
    }

    static hostRegex() {
        return /^(https?:\/\/)?([a-zA-Z0-9.-]+)(:\d{1,5})?(\/.*)?$/;
    }

    static vaultReferenceRegex() {
        return /^[A-Z0-9_-]+$/;
    }

    static time() {
        return /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
    }

    static generalText() {
        return /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s.,'-]*$/;
    }

    static freeText() {
        return /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s.,'¡!¿?\-]*$/;
    }

    static alphaNumericCode() {
        return /^[a-zA-Z0-9_-]*$/;
    }

    static snakeCase() {
        return /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
    }

    static camelCase() {
        return /^[a-z]+([A-Z][a-z0-9]*)*$/;
    }

    static PascalCase() {
        return /^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)*$/;
    }

    static kebabCase() {
        return /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    }

    static emailList() {
        // NO-SONAR: Expresión regular necesaria para validar una lista por correos de email o templates de secretos.
        return /^(\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|\{\{[a-zA-Z0-9_.]+\}\})\s*)(,\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|\{\{[a-zA-Z0-9_.]+\}\})\s*)*$/;
    }

    static minuteCrontab() {
        const number = "[0-5]?\\d";
        const step = `(?:/${number})?`;
        const range = `${number}(?:-${number})?${step}`;
        const wildcard = `\\*${step}`;
        const part = `(?:${wildcard}|${range})`;
        return new RegExp(`^${part}(?:,${part})*$`);
    }

    static hourCrontab() {
        const number = "(?:1?\\d|2[0-3])";
        const step = `(?:/${number})?`;
        const range = `${number}(?:-${number})?${step}`;
        const wildcard = `\\*${step}`;
        const part = `(?:${wildcard}|${range})`;
        return new RegExp(`^${part}(?:,${part})*$`);
    }

    static dayOfMonthCrontab() {
        const number = "(?:[1-9]|[12]\\d|3[01])";
        const step = `(?:/${number})?`;
        const range = `${number}(?:-${number})?${step}`;
        const wildcardOrQ = "(?:\\*|\\?)";
        const part = `(?:${wildcardOrQ}|${range})`;
        return new RegExp(`^${part}(?:,${part})*$`);
    }

    static monthCrontab() {
        const number = "(?:1[0-2]|0?[1-9])";
        const step = `(?:/${number})?`;
        const range = `${number}(?:-${number})?${step}`;
        const wildcard = `\\*${step}`;
        const part = `(?:${wildcard}|${range})`;
        return new RegExp(`^${part}(?:,${part})*$`);
    }

    static dayOfWeekCrontab() {
        const number = "[1-7]";
        const step = `(?:/${number})?`;
        const range = `${number}(?:-${number})?${step}`;
        const wildcardOrQ = "(?:\\*|\\?)";
        const part = `(?:${wildcardOrQ}|${range})`;
        return new RegExp(`^${part}(?:,${part})*$`);
    }

    static pathRegex() {
        return /^([\w$]+(\[\d+\])?)(\.[\w$]+(\[\d+\])?)*$/;
    }
}
