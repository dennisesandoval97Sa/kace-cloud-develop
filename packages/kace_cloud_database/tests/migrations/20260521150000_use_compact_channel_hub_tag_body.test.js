import { test } from 'node:test';
import assert from 'node:assert/strict';

import { compactChannelHubEmailRuleBody } from '../../migrations/20260521150000_use_compact_channel_hub_tag_body.js';

test('uses one compact channel_hub_tag context object as Channel Hub email rule body', () => {
    const existingBody = JSON.stringify({
        body: {
            connectionId: 'context.channel_hub_tag.connectionId',
            ruleName: 'context.channel_hub_tag.ruleName',
            subjectContains: 'context.channel_hub_tag.subjectContains',
            subjectEquals: 'context.channel_hub_tag.subjectEquals',
            actionRules: 'context.channel_hub_tag.actionRules',
        },
    });

    assert.equal(compactChannelHubEmailRuleBody(existingBody), JSON.stringify({ body: 'context.channel_hub_tag' }));
});
