import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';

describe('Channel Hub stack event publishing permissions', () => {
    it('grants the Lambda permission to publish priority reorder events', () => {
        const stack = readFileSync(new URL('../lib/channel-hub-stack.ts', import.meta.url), 'utf8');

        expect(stack).toMatch(/this\.grantEventPublishingPermissions\(lambdaFunction\)/);
    });

    it('exposes reorder as a POST subresource instead of PUT on the collection', () => {
        const stack = readFileSync(new URL('../lib/channel-hub-stack.ts', import.meta.url), 'utf8');

        expect(stack).toMatch(/addResource\('reorder'\)[\s\S]*addMethod\('POST'/);
        expect(stack).not.toMatch(/workspacePrioritiesResource\.addMethod\('PUT'/);
    });
});
