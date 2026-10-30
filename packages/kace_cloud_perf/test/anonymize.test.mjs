import { applyRulesToRow, buildRuleIndex, rewriteCopyLine } from '../data/anonymizer/anonymize.mjs';

describe('buildRuleIndex', () => {
    it('groups rules by table for O(1) lookup', () => {
        const manifest = {
            rules: [
                { table: 'users', column: 'email', transformer: 'fakeEmail' },
                { table: 'users', column: 'phone', transformer: 'fakePhone' },
                { table: 'cases', column: 'description', transformer: 'loremIpsum' },
            ],
        };

        const index = buildRuleIndex(manifest);

        expect(index.get('users')).toHaveLength(2);
        expect(index.get('cases')).toHaveLength(1);
        expect(index.get('absent')).toBeUndefined();
    });
});

describe('applyRulesToRow', () => {
    const manifest = {
        rules: [
            { table: 'users', column: 'email', transformer: 'fakeEmail' },
            { table: 'users', column: 'first_name', transformer: 'fakeFirstName' },
        ],
    };
    const index = buildRuleIndex(manifest);

    it('replaces only the columns named in the rules', () => {
        const row = {
            id: 1,
            email: 'real@example.com',
            first_name: 'Roberto',
            last_name: 'Garcia',
            tenant_id: 'asistencia',
        };

        const result = applyRulesToRow('users', row, index);

        expect(result.email).not.toBe('real@example.com');
        expect(result.first_name).not.toBe('Roberto');
        expect(result.last_name).toBe('Garcia');
        expect(result.tenant_id).toBe('asistencia');
        expect(result.id).toBe(1);
    });

    it('returns the row unchanged when no rules apply to the table', () => {
        const row = { id: 1, code: 'XYZ' };

        const result = applyRulesToRow('classifications', row, index);

        expect(result).toEqual(row);
    });

    it('does not mutate the input row (pure)', () => {
        const row = { id: 1, email: 'x@y.com' };
        const snapshot = { ...row };

        applyRulesToRow('users', row, index);

        expect(row).toEqual(snapshot);
    });
});

describe('rewriteCopyLine', () => {
    const manifest = {
        rules: [{ table: 'users', column: 'email', transformer: 'redact' }],
    };
    const index = buildRuleIndex(manifest);

    it('rewrites the email column inside a tab-separated COPY line', () => {
        const columns = ['id', 'email', 'first_name'];
        const line = '1\treal@example.com\tRoberto';

        const result = rewriteCopyLine('users', columns, line, index);

        expect(result).toBe('1\t[REDACTED]\tRoberto');
    });

    it('returns the line unchanged when no rules apply', () => {
        const columns = ['id', 'code'];
        const line = '1\tXYZ';

        const result = rewriteCopyLine('classifications', columns, line, index);

        expect(result).toBe(line);
    });

    it('preserves the COPY end-of-data marker (\\.)', () => {
        const result = rewriteCopyLine('users', ['id', 'email'], '\\.', index);

        expect(result).toBe('\\.');
    });
});
