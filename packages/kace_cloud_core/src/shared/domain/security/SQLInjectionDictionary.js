export class SQLInjectionDictionary {
    /**
     * A set of known SQL Injection patterns.
     */
    static prohibitedSet = new Set(SQLInjectionDictionary.prohibitedWords());
    static prohibitedCriteriaSet = new Set(SQLInjectionDictionary.prohibitedWordsCriteria());

    /**
     * Detects SQL Injection patterns in the given input string.
     *
     * This method uses a list of known SQL Injection keywords and patterns to check
     * if the input string contains any of these patterns.
     *
     * @param {string} value - The input string to be checked for SQL Injection patterns.
     * @returns {Array<string>} An array of detected SQL Injection patterns, or empty if the input is not a string.
     */
    static findSQLInjectionPatterns(value) {
        if (typeof value !== 'string') return [];

        const tokens = SQLInjectionDictionary.tokenize(value);

        const matches = tokens.filter((token) => SQLInjectionDictionary.prohibitedSet.has(token));

        return [...new Set(matches)];
    }

    static findSQLInjectionCriteriaPatterns(value) {
        if (typeof value !== 'string') return [];

        const tokens = SQLInjectionDictionary.tokenize(value);

        const matches = tokens.filter((token) => SQLInjectionDictionary.prohibitedCriteriaSet.has(token));

        return [...new Set(matches)];
    }

    /**
     * Tokenizes the input text by splitting it into an array of words.
     *
     * @param {string} text - The input text to be tokenized.
     *
     * @returns {Array<string>} An array of words extracted from the input text.
     */
    static tokenize(text) {
        return text
            .toLowerCase()
            .split(/[\s<>"'()=;:]+/) // SONAR-EXC: -> This regex is used to split the input text into words.
            .filter(Boolean);
    }

    /**
     * Retrieves a list of patterns known to be associated with SQL Injection attacks.
     *
     * @returns {Array<string>} An array of prohibited patterns related to SQL Injection.
     */
    static prohibitedWords() {
        return [
            '--',
            '/*',
            '/*…*/',
            ';%00',
            '@@variable',
            '@variable',
            'chr',
            'exec',
            'execute',
            'dbms_pipe.receive_message',
            'randomblob',
            'benchmark',
            'delay',
            'false',
            'from',
            'group by',
            'xor',
            'having',
            'into',
            'is null',
            'like',
            'order by',
            'pg_sleep',
            'rlike',
            'select',
            'sleep',
            'true',
            'waitfor',
            'where',
            '||',
            '../etc/pass',
            '../etc/password',
            '../etc',
            '../etc/',
            '..',
            '../',
            'outfile',
            'dumpfile',
            'information_schema',
            'sysibm',
            'sysdummy1',
            'load_file',
        ];
    }

    static prohibitedWordsCriteria() {
        return [
            '--',
            '/*',
            '/*…*/',
            ';%00',
            '@@variable',
            '@variable',
            'chr',
            'exec',
            'execute',
            'dbms_pipe.receive_message',
            'randomblob',
            'benchmark',
            'delay',
            'from',
            'group by',
            'xor',
            'into',
            'pg_sleep',
            'rlike',
            'sleep',
            'waitfor',
            'where',
            '||',
            '../etc/pass',
            '../etc/password',
            '../etc',
            '../etc/',
            '..',
            '../',
            'outfile',
            'dumpfile',
            'information_schema',
            'sysibm',
            'sysdummy1',
            'load_file',
        ];
    }
}
