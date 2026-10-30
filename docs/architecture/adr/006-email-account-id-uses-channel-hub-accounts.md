# ADR-006: Email Account ID Uses Channel Hub Accounts

**Status:** Accepted

## Context

KACE Cloud previously modeled `emails.account_id` as a reference to `mail_accounts`, but agent email sending, replying, and receiving now run through Channel Hub. Keeping new agent email writes tied to `mail_accounts` would make the stored account reference point at the notification-email model instead of the integration account that actually handled the conversation.

## Decision

New agent email send, reply, receive, and import records use `emails.account_id` as a Channel Hub Account reference. `sender` remains the external customer origin on the Email and must not be used to infer the receiving account. When an email create flow must infer the account, it should use delivered recipients and only infer when exactly one Channel Hub Account is represented; otherwise the receiving account must be explicit.

## Consequences

- `mail_accounts` remains available for notification email delivery, not agent email conversation ownership.
- New agent email records align with Channel Hub send, reply, and inbound processing.
- Existing historical rows may still contain legacy mailbox account references and should be treated as compatibility data.
- Reads should treat `emails.account_id` as an opaque stored account reference unless a feature explicitly needs to join to Channel Hub.
