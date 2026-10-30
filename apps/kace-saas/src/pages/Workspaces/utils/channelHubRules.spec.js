import { describe, expect, it } from "vitest";
import { hasPendingChannelHubAccounts, hasRegisteredChannelHubRule } from "./channelHubRules";

describe("hasRegisteredChannelHubRule", () => {
    it("detects registered Channel Hub rules from the workspace rule id", () => {
        expect(hasRegisteredChannelHubRule({ rules: { ruleId: "3EJTuLucMyGCOmCcJehd6yT9Ywk" } })).toBe(true);
        expect(hasRegisteredChannelHubRule({ rules: { ruleId: "   " } })).toBe(false);
        expect(hasRegisteredChannelHubRule({ rules: { ruleId: 123 } })).toBe(true);
        expect(hasRegisteredChannelHubRule({ rules: {} })).toBe(false);
    });
});

describe("hasPendingChannelHubAccounts", () => {
    const usableAccount = (overrides = {}) => ({
        id: "account-id",
        channel_hub_connection_id: "connection-id",
        channel_hub_rule_id: null,
        ...overrides,
    });

    it("reports pending when a usable account has no rule id yet", () => {
        expect(
            hasPendingChannelHubAccounts({
                rules: {},
                channel_hub_accounts: [usableAccount()],
            }),
        ).toBe(true);
    });

    it("reports nothing pending when every usable account is registered", () => {
        expect(
            hasPendingChannelHubAccounts({
                rules: {},
                channel_hub_accounts: [
                    usableAccount({ channel_hub_rule_id: "rule-1" }),
                    usableAccount({ id: "account-2", channel_hub_rule_id: "rule-2" }),
                ],
            }),
        ).toBe(false);
    });

    it("reports pending accounts added next to registered ones", () => {
        expect(
            hasPendingChannelHubAccounts({
                rules: {},
                channel_hub_accounts: [
                    usableAccount({ channel_hub_rule_id: "rule-1" }),
                    usableAccount({ id: "account-2" }),
                ],
            }),
        ).toBe(true);
    });

    it("treats the legacy scalar rules.ruleId as covering a single account", () => {
        expect(
            hasPendingChannelHubAccounts({
                rules: { ruleId: "legacy-rule" },
                channel_hub_accounts: [usableAccount()],
            }),
        ).toBe(false);
    });

    it("still reports pending accounts added to a legacy registered workspace", () => {
        expect(
            hasPendingChannelHubAccounts({
                rules: { ruleId: "legacy-rule" },
                channel_hub_accounts: [usableAccount(), usableAccount({ id: "account-2" })],
            }),
        ).toBe(true);
    });

    it("reports nothing pending without usable accounts", () => {
        expect(hasPendingChannelHubAccounts({ rules: {}, channel_hub_accounts: [] })).toBe(false);
        expect(
            hasPendingChannelHubAccounts({
                rules: {},
                channel_hub_accounts: [usableAccount({ channel_hub_connection_id: "  " })],
            }),
        ).toBe(false);
    });

    it("falls back to the legacy scalar semantics when the account list is unknown", () => {
        expect(hasPendingChannelHubAccounts({ rules: {} })).toBe(true);
        expect(hasPendingChannelHubAccounts({ rules: { ruleId: "legacy-rule" } })).toBe(false);
    });
});
