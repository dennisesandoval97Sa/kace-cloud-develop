import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const schemaUrl = new URL('../src/schemas.mjs', import.meta.url).href;

function validInteractionPayload() {
    const userId = randomUUID();

    return {
        id: randomUUID(),
        channel_id: 'email',
        client_identifier: 'j01pmpaladsinc@cendoj.ramajudicial.gov.co',
        external_identifier: randomUUID(),
        description: '2025-00316-00 NOTIFICA SENTENCIA DE TUTELA',
        priority: 'normal',
        workspace_id: randomUUID(),
        email_id: null,
        start_review_at: null,
        start_review_by: null,
        conversation_id: '19b6ba15e0084436',
        receipt_at: '2025-12-29T19:41:32.000Z',
        closed_at: '2026-01-02T14:22:14.000Z',
        closed_by: userId,
        is_closed: true,
        in_review: false,
        is_migrated: true,
        created_by: userId,
    };
}

function validateWithInteractionCreate(...payloads) {
    // Jest parses this package's .js files as CommonJS; the runtime loads schemas.js as ESM.
    const script = `
        const { interactionCreate } = await import(${JSON.stringify(schemaUrl)});
        const payloads = JSON.parse(process.argv[1]);
        const results = payloads.map((payload) => {
            if (payload.created_at) {
                payload.created_at = new Date(payload.created_at);
            }
            const { error, value } = interactionCreate.validate(payload, { abortEarly: false });
            return {
                error: error?.details.map(({ path, message }) => ({ path: path.join('.'), message })),
                value: {
                    email_id: value?.email_id,
                    is_migrated: value?.is_migrated,
                },
            };
        });
        process.stdout.write(JSON.stringify(results));
    `;

    return JSON.parse(
        execFileSync(
            process.execPath,
            ['--experimental-default-type=module', '--eval', script, JSON.stringify(payloads)],
            {
                encoding: 'utf8',
            }
        )
    );
}

describe('interactionCreate schema', () => {
    it('allows migration fields on API interaction create payloads', () => {
        const payload = { ...validInteractionPayload(), created_at: '2026-01-02T14:20:02.000Z' };
        const [result] = validateWithInteractionCreate(payload);

        expect(result.error).toBeUndefined();
        expect(result.value.email_id).toBeNull();
        expect(result.value.is_migrated).toBe(true);
    });

    it('allows null is_migrated values for API compatibility', () => {
        const payload = {
            ...validInteractionPayload(),
            closed_at: null,
            closed_by: null,
            is_closed: false,
            is_migrated: null,
        };
        const [result] = validateWithInteractionCreate(payload);

        expect(result.error).toBeUndefined();
        expect(result.value.is_migrated).toBeNull();
    });

    it.each([
        ['closed', { is_closed: true, is_migrated: false }],
        [
            'in-review',
            {
                closed_at: null,
                closed_by: null,
                in_review: true,
                is_closed: false,
                is_migrated: false,
                start_review_at: '2026-01-02T14:20:02.000Z',
                start_review_by: randomUUID(),
            },
        ],
    ])('rejects a non-migrated %s state', (_state, overrides) => {
        const [result] = validateWithInteractionCreate({ ...validInteractionPayload(), ...overrides });

        expect(result.error).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ message: expect.stringContaining('is_migrated is true') }),
            ])
        );
    });

    it('requires close metadata for a migrated closed state', () => {
        const payload = { ...validInteractionPayload(), closed_at: null, closed_by: null };
        const [result] = validateWithInteractionCreate(payload);

        expect(result.error).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ message: expect.stringContaining('requires closed_at and closed_by') }),
            ])
        );
    });

    it('requires review metadata for a migrated in-review state', () => {
        const payload = {
            ...validInteractionPayload(),
            closed_at: null,
            closed_by: null,
            in_review: true,
            is_closed: false,
        };
        const [result] = validateWithInteractionCreate(payload);

        expect(result.error).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    message: expect.stringContaining('requires start_review_at and start_review_by'),
                }),
            ])
        );
    });

    it('rejects a migrated interaction that is both closed and in review', () => {
        const payload = {
            ...validInteractionPayload(),
            in_review: true,
            start_review_at: '2026-01-02T14:20:02.000Z',
            start_review_by: randomUUID(),
        };
        const [result] = validateWithInteractionCreate(payload);

        expect(result.error).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ message: expect.stringContaining('closed and in review') }),
            ])
        );
    });
});
