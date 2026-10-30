import { WordsForDictionary } from './WordsForDictionary';

export class RegexPatterns {
    static dictionaryRegex() {
        const words = WordsForDictionary.getWords();
        const escapedWords = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); // SONAR-EXC: The guards are responsible for validating the value, avoiding intense CPU usage
        const regexPattern = `(?:^|\\s|$)(?:${escapedWords.join('|')})(?:^|\\s|$)`;
        return new RegExp(regexPattern, 'iu');
    }

    static onlyLetters() {
        return /^[a-zA-ZÀ-ÿ\s]+$/;
    }

    static descriptionRegex() {
        return /^[a-zA-ZÀ-ÿ0-9\s.,!?-]+$/;
    }

    static colorRegex() {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/; // SONAR-EXC: The guards are responsible for validating the value, avoiding intense CPU usage
    }

    static referenceSecretRegex() {
        return /^[A-Z0-9_-]+$/;
    }

    static hostRegex() {
        return /^(https?:\/\/)?([a-zA-Z0-9.-]+)(:\d{1,5})?(\/.*)?$/; // SONAR-EXC: The guards are responsible for validating the value, avoiding intense CPU usage
    }

    static vaultReferenceRegex() {
        return /^[A-Z0-9_-]+$/;
    }

    static time() {
        return /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
    }

    /*
     * El apostrofe ASCII (') y la comilla tipografica de cierre (’, U+2019) forman parte de
     * apellidos legitimos -O'Connor, D'Angelo, Degl'Innocenti- y estaban fuera del juego, que
     * en cambio si admitia la comilla de apertura (‘, U+2018). La proteccion frente a inyeccion
     * la dan SQLInjectionGuard y XSSGuard, no esta lista de caracteres.
     * Mirrors apps/kace-saas/src/utils/regex/RegexPatterns.js - keep both in sync.
     */
    static extendedCharactersRegex() {
        return /^[a-zA-ZÀ-ž0-9\s#&()%.\-_@'‘’:{};,~“‰\/\\|+¿?¡!*[\]]*$/;
    }

    /*
     * Used for rich-text HTML bodies (Comments/Helps/Case descriptions - Templates cuerpo
     * uses HtmlTemplateSanitizer's structural allowlist instead and doesn't call this), all
     * edited via the Lexical RichEditor. Content safety comes from the XSSGuard keyword
     * blocklist, not from this character list, so it only needs to reject control characters
     * (possible sign of malformed/binary input), not legitimate content like emoji or uncommon
     * symbols that a narrower enumerated whitelist would otherwise block. Mirrors the frontend
     * copy in apps/kace-saas/src/utils/regex/RegexPatterns.js - keep both in sync.
     */
    static extendedHtmlRegex() {
        // eslint-disable-next-line no-control-regex -- intentional: this pattern's job is precisely to reject control characters
        return /^[^\x00-\x08\x0B\x0C\x0E-\x1F\x7F]*$/u;
    }

    static emailRegex() {
        return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/; // SONAR-EXC: The guards are responsible for validating the value, avoiding intense CPU usage
    }
}
