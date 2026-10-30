import { WorkspaceCreateSchema, WorkspaceDeactivateSchema, WorkspaceUpdateSchema } from '../src/WorkspaceSchema.mjs';

const uuid = 'cc7abc0c-a7a3-4226-8dfd-01a1d5e9d457';
const userId = '3824c61a-6368-4c5c-957f-769525109e85';
const channelHubAccountId = '906b7167-e01f-459d-8234-4c2239141e5c';

const routingRules = {
    ruleName: 'support',
    subjectContains: [],
    subjectEquals: [],
    ccContains: [],
    ccEquals: [],
    fromContains: [],
    fromEquals: [],
    toContains: ['recipient@example.com'],
    toEquals: [],
    bodyContains: [],
    bodyEquals: ['urgent body'],
    actionRules: {
        classifyAs: 'support',
    },
};

describe('Workspace routing rules schema', () => {
    it('accepts Para and Cuerpo routing fields on create', () => {
        const result = WorkspaceCreateSchema.validate(
            {
                id: uuid,
                description: 'workspace-test',
                tag: 'support',
                is_active: true,
                rules: routingRules,
                channel_hub_accounts: [{ id: channelHubAccountId }],
                created_by: userId,
                created_at: new Date().toISOString(),
            },
            { abortEarly: false }
        );

        expect(result.error).toBeUndefined();
        expect(result.value.rules).toEqual(routingRules);
    });

    it('accepts Para and Cuerpo routing fields on update', () => {
        const result = WorkspaceUpdateSchema.validate(
            {
                description: 'workspace-test',
                tag: 'support',
                is_active: true,
                rules: routingRules,
                updated_by: userId,
                updated_at: new Date().toISOString(),
            },
            { abortEarly: false }
        );

        expect(result.error).toBeUndefined();
        expect(result.value.rules).toEqual(routingRules);
    });

    const validateUpdateRules = (rules) =>
        WorkspaceUpdateSchema.validate(
            { rules, updated_by: userId, updated_at: new Date().toISOString() },
            { abortEarly: false }
        );

    const outOfRangeValues = [
        ['', 'string.empty'],
        ['abc', 'string.min'],
        ['a'.repeat(51), 'string.max'],
    ];

    it.each(outOfRangeValues)('rejects rule value %j outside the 4-50 character range', (value, expectedType) => {
        const result = validateUpdateRules({ ...routingRules, subjectContains: [value] });

        expect(result.error?.details).toEqual([
            expect.objectContaining({ path: ['rules', 'subjectContains', 0], type: expectedType }),
        ]);
    });

    it.each(['abcd', 'a'.repeat(50)])('accepts rule value %j at the 4-50 character boundaries', (value) => {
        const result = validateUpdateRules({ ...routingRules, subjectContains: [value] });

        expect(result.error).toBeUndefined();
    });

    it.each([
        ['    ', 'string.min'],
        ['  ab  ', 'string.min'],
        [` ${'a'.repeat(51)} `, 'string.max'],
    ])('measures rule value %j without its surrounding whitespace', (value, expectedType) => {
        const result = validateUpdateRules({ ...routingRules, subjectContains: [value] });

        expect(result.error?.details).toEqual([
            expect.objectContaining({ path: ['rules', 'subjectContains', 0], type: expectedType }),
        ]);
    });

    it('keeps the surrounding whitespace of a valid rule value as sent', () => {
        const paddedMaxValue = `  ${'a'.repeat(50)}  `;
        const result = validateUpdateRules({ ...routingRules, subjectContains: ['  abcd  ', paddedMaxValue] });

        expect(result.error).toBeUndefined();
        expect(result.value.rules.subjectContains).toEqual(['  abcd  ', paddedMaxValue]);
    });

    // Persisted legacy snapshots, including values outside the 4-50 range of the structured rules.
    const legacyArrayRules = [
        [[{ field: 'subject', operator: 'contains' }]],
        [[{ field: 'subject', operator: 'contains', value: '' }]],
        [[{ field: 'subject', operator: 'contains', value: 'ab' }]],
        [[{ field: 'subject', operator: 'contains', value: 12345 }]],
        [[{ field: 'subject', operator: 'contains', value: '  abcd  ', label: 'legacy' }]],
        [[{}]],
    ];

    it.each(legacyArrayRules)('keeps accepting legacy array rules %j as sent on update', (rules) => {
        const result = validateUpdateRules(rules);

        expect(result.error).toBeUndefined();
        expect(result.value.rules).toEqual(rules);
    });

    it.each(legacyArrayRules)('keeps accepting legacy array rules %j as sent on deactivate', (rules) => {
        const result = WorkspaceDeactivateSchema.validate(
            { rules, updated_by: userId, updated_at: new Date().toISOString() },
            { abortEarly: false }
        );

        expect(result.error).toBeUndefined();
        expect(result.value.rules).toEqual(rules);
    });

    it.each(legacyArrayRules)('keeps accepting legacy array rules %j as sent on create', (rules) => {
        const result = WorkspaceCreateSchema.validate(
            { id: uuid, tag: 'support', rules, channel_hub_accounts: [{ id: channelHubAccountId }] },
            { abortEarly: false }
        );

        expect(result.error).toBeUndefined();
        expect(result.value.rules).toEqual(rules);
    });

    it.each([[[null]], [['abcd']], [[[{ field: 'subject', operator: 'contains', value: 'abcd' }]]]])(
        'rejects legacy array rules %j whose items are not objects',
        (rules) => {
            const result = validateUpdateRules(rules);

            expect(result.error?.details).toEqual([expect.objectContaining({ path: ['rules', 0] })]);
        }
    );

    it('rejects a rule value outside the 4-50 character range on create', () => {
        const result = WorkspaceCreateSchema.validate(
            {
                id: uuid,
                tag: 'support',
                rules: { ...routingRules, subjectContains: ['abc'] },
                channel_hub_accounts: [{ id: channelHubAccountId }],
                created_by: userId,
            },
            { abortEarly: false }
        );

        expect(result.error?.details).toEqual([
            expect.objectContaining({ path: ['rules', 'subjectContains', 0], type: 'string.min' }),
        ]);
    });

    it('validates submitted rules on deactivate', () => {
        const result = WorkspaceDeactivateSchema.validate(
            {
                rules: { ...routingRules, subjectContains: ['abc'] },
                updated_by: userId,
                updated_at: new Date().toISOString(),
            },
            { abortEarly: false }
        );

        expect(result.error?.details).toEqual([
            expect.objectContaining({ path: ['rules', 'subjectContains', 0], type: 'string.min' }),
        ]);
    });

    it('deactivates without rules so persisted rules are kept', () => {
        const result = WorkspaceDeactivateSchema.validate(
            { updated_by: userId, updated_at: new Date().toISOString() },
            { abortEarly: false }
        );

        expect(result.error).toBeUndefined();
        expect(result.value).not.toHaveProperty('rules');
    });

    it('rejects unrelated workspace rule keys', () => {
        const result = WorkspaceCreateSchema.validate(
            {
                id: uuid,
                description: 'workspace-test',
                tag: 'support',
                is_active: true,
                rules: {
                    unexpectedRule: true,
                },
                channel_hub_accounts: [{ id: channelHubAccountId }],
                created_by: userId,
                created_at: new Date().toISOString(),
            },
            { abortEarly: false }
        );

        expect(result.error).toBeDefined();
    });
});
