import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    addChannelHubEmailRuleBindings,
    removeChannelHubEmailRuleBindings,
} from '../../migrations/20260521143000_add_action_rules_to_channel_hub_email_rule_endpoint.js';

test('adds missing Channel Hub email rule actionRules binding without changing existing bindings', () => {
    const body = JSON.stringify({
        body: {
            connectionId: 'context.channel_hub_tag.connectionId',
            ruleName: 'context.channel_hub_tag.ruleName',
            bodyContains: 'context.channel_hub_tag.bodyContains',
        },
    });

    assert.equal(
        addChannelHubEmailRuleBindings(body),
        JSON.stringify({
            body: {
                connectionId: 'context.channel_hub_tag.connectionId',
                ruleName: 'context.channel_hub_tag.ruleName',
                bodyContains: 'context.channel_hub_tag.bodyContains',
                actionRules: 'context.channel_hub_tag.actionRules',
            },
        })
    );
});

test('removes only the bindings added by the migration', () => {
    const body = JSON.stringify({
        body: {
            connectionId: 'context.channel_hub_tag.connectionId',
            actionRules: 'context.channel_hub_tag.actionRules',
            webhooks: 'context.channel_hub_tag.webhooks',
        },
    });

    assert.equal(
        removeChannelHubEmailRuleBindings(body),
        JSON.stringify({
            body: {
                connectionId: 'context.channel_hub_tag.connectionId',
                webhooks: 'context.channel_hub_tag.webhooks',
            },
        })
    );
});
