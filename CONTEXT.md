# KACE Cloud

KACE Cloud receives customer communications from external channels and turns them into work that can be handled inside the agent workspace.

## Language

**Channel Hub**:
An external communication service that delivers customer email events to KACE Cloud.
_Avoid_: Channel Hub API when referring to the business channel.

**Channel Hub Account**:
An email identity registered with **Channel Hub** so that Channel Hub can deliver inbound email events for it.
_Avoid_: Workspace, interaction, inbound webhook.

**Channel Hub Registration Flow**:
An active, retained workflow chosen for a **Channel Hub Account** to register that email identity with **Channel Hub**.
_Avoid_: Any Rest Flow, inactive workflow, deleted workflow, generic workflow.

**Channel Hub Mail Rule**:
An external rule owned by **Channel Hub** that classifies an inbound message with a **Workspace Reference** and participates in the live processing order for one **Channel Hub Account**.
_Avoid_: Workspace, locally stored priority, display name.

**Workspace Processing Order**:
The live priority sequence of **Channel Hub Mail Rules** for one **Channel Hub Account**, read from and changed in **Channel Hub**.
_Avoid_: Email urgency, Interaction priority, locally persisted Workspace order.

**Mail Account**:
A mailbox identity configured in KACE Cloud for notification email delivery outside the agent email conversation flow.
_Avoid_: Sender, customer email, Channel Hub account, agent email account.

**Inbound Channel Hub Email**:
A customer email event delivered by **Channel Hub** that is represented in KACE Cloud as both an **Email** and an **Interaction**.
_Avoid_: Webhook, payload, todo, Channel Hub account.

**External Message ID**:
The provider-issued identifier for an **Inbound Channel Hub Email** used to recognize repeated deliveries.
_Avoid_: Email database ID, interaction ID.

**Email**:
The stored message record for a received customer email, including recipients, body, and attachments.
_Avoid_: Interaction.

**Email Sender**:
The customer or external origin address recorded on an **Email**.
_Avoid_: Receiving account, Mail Account, Channel Hub Account.

**Email Recipient**:
An address to which an **Email** was delivered, including direct, copied, or blind-copied delivery.
_Avoid_: Email Sender, receiving account.

**Email ID**:
The canonical identifier of a stored **Email**.
_Avoid_: External Message ID, prepared import identifier.

**Email Account ID**:
The **Channel Hub Account** identifier recorded on an agent email record.
_Avoid_: Mail Account ID, Email Sender.

**Email Body**:
The readable content of an **Email** as received from the channel.
_Avoid_: Presigned URL.

**HTML Email Body**:
The formatted representation of an **Email Body** intended for rich rendering.
_Avoid_: Plain-text body, plain-text overflow storage.

**External Email Body Reference**:
An internal reference used to retrieve the retained full **Email Body** when only a preview is stored with the **Email** record.
_Avoid_: Tenant S3 URL, presigned URL, Email Body.

**Email Attachment**:
A file received with an **Email** and retained for agent access.
_Avoid_: Temporary provider URL.

**Email Template**:
A reusable outbound email message definition for agent or automated case communication.
_Avoid_: Generic template, report template.

**Classification**:
A case-categorization definition composed of an ordered hierarchy of **Classification Levels** and optional **Classification-Email Template Associations**.
_Avoid_: Group, Flow, Case.

**Classification Level**:
One named position in a **Classification**'s ordered categorization hierarchy.
_Avoid_: Duplicate level, form field, nivel.

**Classification-Email Template Association**:
The association that makes an **Email Template** available for a **Classification**.
_Avoid_: Group membership, template attachment.

**Template Attachment**:
A file attached to an **Email Template** for reuse when template-based email is sent.
_Avoid_: Case attachment, Email attachment.

**Attachment Filename**:
The display name retained for an **Email Attachment**.
_Avoid_: S3 object key.

**Interaction**:
A customer contact item created from an inbound channel message and routed for agent handling.
_Avoid_: Email.

**Interaction Status**:
The operational state of an **Interaction**: **Open** when it is available for handling, **In Review** when it is being handled, and **Closed** when it is completed and no longer active.
_Avoid_: Case status, Email status.

**Interaction Search Context**:
The agent's current view for finding and handling **Interactions**, including the workspace scope, status/type filter, committed search text, page, and current **Interaction** selection.
_Avoid_: Disposable filters, table state, browser-only state, transient search input.

**Admin Interaction Search Workspace Eligibility**:
The mandatory workspace baseline for ordinary `/interactions/search`: an **Interaction** with a non-null Workspace reference is eligible only when that referenced **Workspace** has `is_active = true`. A legacy Interaction with a null Workspace reference remains eligible; a non-null orphan reference is ineligible. This cross-group Admin baseline is independent of **Active-Group Workspace Scope** and of the frontend-only **System Inbox Workspace** concealment rule.
_Avoid_: Active-Group Workspace Scope, Workspace soft-delete policy, System Inbox authorization.

**Interaction Email Link Conflict**:
An attempt to create an **Interaction** for an **Email** that already has an **Interaction**.
_Avoid_: Duplicate interaction ID, webhook replay, generic validation error.

**Client**:
A customer identity that can own support work in KACE Cloud.
_Avoid_: User, sender email, agent, platform account.

**User**:
A platform account that can sign in and act inside KACE Cloud (administration or integration), not a **Client**.
_Avoid_: Client, customer, sender email.

**Identity User**:
A **User** whose account type is human/directory-backed identity.
_Avoid_: Service User, Client.

**Service User**:
A **User** whose account type is a non-human integration or service account.
_Avoid_: Identity User, Client.

**Group**:
A named collection of **Users** used for access, operational scope, routing, and **Agenda** appointment handling.
_Avoid_: Workspace, role, Client, user list.

**User-Group Membership**:
The association that places a **User** in a **Group**.
_Avoid_: Role assignment, Client membership, workspace membership.

**Active Group**:
The **Group** currently selected as the **User**'s operational group context.
_Avoid_: Role, default group when not actually selected, Workspace.

**Active-Group Workspace Scope**:
The active, retained **Workspaces** associated with a **User**'s active, retained **Active Group** through that User's current **User-Group Membership**.
_Avoid_: All tenant Workspaces, administrator Workspace access, every Group membership.

**Agent Move Destination Set**:
The active, retained tenant **Workspaces** to which an agent may move an **Interaction** that is currently inside the agent's **Active-Group Workspace Scope**, excluding the **Interaction**'s current **Workspace** and the **System Inbox Workspace**.
_Avoid_: Active-Group Workspace Scope, Agent Workspace discovery, administrator Workspace access.

**Global Configuration**:
A named collection of application settings assigned to a **Group**.
_Avoid_: Global setup, group configuration.

**Attachment Limits**:
The maximum total attachment count, allowed file extensions, and maximum per-file size defined by an **Active Group**'s **Global Configuration**.
A positive attachment count defines a cap; zero means no count cap is configured.
_Avoid_: Attachment settings, upload limits.

**Suggested Client**:
A **Client** found from an **Interaction** sender email that an agent may explicitly choose as the current **Selected Client**.
_Avoid_: Inferred client, automatic client, sender email.

**Selected Client**:
The **Client** an agent has explicitly chosen as the current customer context for agent work.
_Avoid_: Suggested Client, sender email, inferred client.

**Selected Client Change Request**:
An agent's explicit choice that the current **Selected Client** should not be used for the current **Interaction** handling context.
_Avoid_: Page reset, interaction reset, filter reset.

**Suggested Client Dismissal**:
An agent's explicit choice not to make a **Suggested Client** the **Selected Client** for the current **Interaction** handling context.
_Avoid_: Precharge rejection, page reload, filter reset.

**Case**:
A support work record opened for a **Client** and handled by agents.
_Avoid_: Interaction, Email.

**Classification Path**:
The ordered sequence of every non-empty classification level assigned to a **Case**, from the shallowest level to the deepest; missing intermediate levels do not hide deeper levels.
_Avoid_: Classification children, selected level, descendant levels.

**Case Attachment**:
A file attached to a **Case** as part of support work context.
_Avoid_: Email attachment, Template attachment.

**Case Reopen**:
An agent action that moves a closed **Case** back into active handling.
_Avoid_: Generic case update, comment creation.

**Reopen Comment**:
A **Comment** that records the reason for a **Case Reopen** and is linked to the **Case** as its state-change comment.
_Avoid_: Draft comment ID, client-generated comment ID.

**Case Attachment Sending**:
An **Email Template** choice that includes a **Case**'s **Case Attachments** in template-based outbound email.
_Avoid_: Template attachment inclusion, Email attachment.

**Workspace**:
A routing area where inbound **Interactions** are grouped for agent handling.
_Avoid_: Mail account, Channel Hub account.

**Workspace-Group Relationship**:
The association that makes a **Workspace** part of a **Group**'s agent-handling scope.
_Avoid_: User-Group Membership, Workspace ownership, role assignment.

**Group-Unassigned Workspace**:
A **Workspace** with no **Workspace-Group Relationship** to any retained **Group**; relationships only to deleted Groups do not count.
_Avoid_: Deleted Workspace, inactive Workspace, System Inbox Workspace.

**System Inbox Workspace**:
The operationally retained **Workspace** identified only by the canonical ID
`dbcc5b5a-61bb-4b5a-95d0-9f6222749e54`, used as a fallback for email processing but
hidden from role-specific frontend workspace choices.
_Avoid_: Any Workspace named or tagged Inbox, default visible Workspace, deleted Workspace.

**Agenda**:
A schedule-owning configuration that defines appointment availability rules, including daily and time-slot capacity.
_Avoid_: Calendar UI, appointment, group schedule, user calendar.

**Agenda-Group Relationship**:
The association that makes an **Agenda** available to a **Group**.
_Avoid_: Agenda, group, appointment.

**Workspace Reference**:
An inbound-channel value that identifies the target **Workspace**.
_Avoid_: Mailbox, account, arbitrary tag.

**Appointment Time Slot**:
A bounded time interval within an **Agenda** where appointments may be accepted up to that slot's capacity.
_Avoid_: Appointment, agenda, calendar event.

**Appointment Time Slot Capacity**:
The maximum number of appointments accepted inside one **Appointment Time Slot**.
_Avoid_: Agenda daily limit, number of existing appointments.

**Agenda Daily Limit**:
The maximum number of appointments an **Agenda** may accept in one day.
_Avoid_: Appointment Time Slot Capacity, total time slots.

**Public Error Code**:
A stable, non-sensitive identifier returned to clients when an API request cannot be processed, used by support and client applications to recognize the failure class without exposing internal details.
_Avoid_: Stack trace, validation rule, database error, HTTP status.

**Public Error Response**:
The client-facing failure response for an API request, containing a generic message and a **Public Error Code** while keeping diagnostic details out of the public body.
_Avoid_: Backend exception, debug output, validation internals.

**Public Error Code Mirror**:
A client-side copy of the canonical **Public Error Codes** used by a frontend application for translations and UI behavior, kept in sync with the canonical backend registry.
_Avoid_: Independent error registry, duplicated source of truth.

**Automation Settings**:
A configuration that makes automated actions eligible to run on a recurring frequency within a date range.
_Avoid_: Cron job, worker scheduler, background execution.

**Automation Frequency**:
The recurrence on **Automation Settings** that says how often its automated actions become eligible during the active date range.
_Avoid_: Crontab, cron expression.

## Relationships

- A **Channel Hub Account** belongs to exactly one email identity in **Channel Hub**.
- A **Channel Hub Account** uses one **Channel Hub Registration Flow**.
- A registered Workspace and **Channel Hub Account** relation owns one stable **Channel Hub Mail Rule** identifier.
- **Channel Hub** is the sole source of truth for **Workspace Processing Order**; KACE Cloud does not persist rule priority.
- A **Channel Hub Mail Rule** is displayed with its related Workspace description and validated against the Workspace Reference, but neither mutable value is its identity.
- A **Channel Hub Registration Flow** must be active and not deleted when it is selected or used.
- A **Channel Hub Registration Flow** is a primary Channel Hub connection workflow; internal branch workflows and non-connection workflows are not valid registration choices.
- A **Mail Account** is used for notification email delivery, not for agent email sending, replying, or receiving.
- A **Workspace** must have one or more **Channel Hub Accounts** for agent email handling.
- An inactive **Workspace** must still have one or more **Channel Hub Accounts**.
- A **Workspace** can be associated with zero or more **Groups** through **Workspace-Group Relationships**.
- A **Group** can be associated with zero or more **Workspaces** through **Workspace-Group Relationships**.
- A **Group-Unassigned Workspace** is outside every **Active-Group Workspace Scope**.
- An agent handles an **Interaction** only when its **Workspace** is inside that agent's **Active-Group Workspace Scope**.
- An agent may move an **Interaction** from its **Active-Group Workspace Scope** to any **Workspace** in the **Agent Move Destination Set**.
- Moving an **Interaction** to a **Workspace** outside the agent's **Active-Group Workspace Scope** immediately removes that **Interaction** from the agent's handling scope without changing general agent Workspace discovery.
- Changing a **Workspace-Group Relationship** does not change which **Workspace** an existing **Interaction** belongs to.
- The **System Inbox Workspace** remains available to backend email processing even when
  role-specific frontend searches exclude it from visible choices.
- A soft-deleted **Channel Hub Account** does not satisfy a **Workspace**'s required **Channel Hub Account** relationship.
- An inactive **Channel Hub Account** can satisfy a **Workspace**'s required **Channel Hub Account** relationship.
- Updating a **Workspace** may omit **Channel Hub Accounts** only when the existing **Workspace** already retains one or more **Channel Hub Accounts**.
- A **Workspace** can be identified on inbound channel messages by a **Workspace Reference**.
- An **Agenda** can be associated with zero or more **Groups** through **Agenda-Group Relationships**.
- A **Group** can be associated with zero or more **Agendas** through **Agenda-Group Relationships**.
- A specific **Agenda** and **Group** can be related to each other at most once.
- An **Inbound Channel Hub Email** is matched to one receiving **Channel Hub Account**.
- An **Inbound Channel Hub Email** has one **External Message ID**.
- An **Inbound Channel Hub Email** produces exactly one **Email** and exactly one **Interaction**.
- An **Email** has one **Email ID**.
- An agent email record has one **Email Account ID**.
- An **Email** has one **Email Sender**.
- An **Email Sender** identifies the external origin of an **Email**, not the receiving **Channel Hub Account**.
- An **Email Recipient** may identify the receiving **Channel Hub Account** only when exactly one **Channel Hub Account** is represented among the delivered recipients.
- An **Email** has one receiving **Channel Hub Account**; if more than one receiving **Channel Hub Account** is possible, the receiver must be made explicit.
- An **Email** has one **Email Body**.
- An **Email Body** may have an **HTML Email Body** for rich rendering.
- An **Email Body** may have an **External Email Body Reference** when the full readable content is retained outside the inline message record.
- An **Email** can have zero or more **Email Attachments**.
- An **Email Attachment** has one **Attachment Filename**.
- An **Email Template** can have zero or more **Template Attachments**.
- **Template Attachments** and **Case Attachment Sending** are independent choices for an **Email Template**.
- A **Classification** has one to ten ordered **Classification Levels**.
- A **Classification** cannot contain two **Classification Levels** whose names are equal after trimming whitespace and ignoring letter case.
- A **Classification** can have zero or more **Email Templates** through **Classification-Email Template Associations**.
- A specific **Classification** and **Email Template** can be associated at most once.
- An **Interaction** created from an **Inbound Channel Hub Email** references the source **Email**.
- An **Email** can be referenced by at most one **Interaction**.
- An **Interaction Email Link Conflict** is reported when a create request would make a second **Interaction** reference the same **Email**.
- A newly created **Interaction** belongs to exactly one **Workspace**; persisted legacy rows may have no Workspace reference.
- Ordinary Admin `/interactions/search` applies **Admin Interaction Search Workspace Eligibility** identically to returned rows and `metadata.count`.
- An **Interaction** has one **Interaction Status**: **Open**, **In Review**, or **Closed**.
- **Closed** takes precedence over **In Review** when determining the **Interaction Status**.
- An **Interaction Search Context** should survive **Suggested Client Dismissal**, client-selection navigation, and a full browser refresh.
- If a restored **Interaction Search Context** no longer contains its previous **Interaction** selection, the search context remains active and only the current **Interaction** selection is cleared.
- A **Client** can have zero or more **Cases**.
- A **Case** belongs to exactly one **Client**.
- A **Case** can have zero or more **Case Attachments**.
- A **Case Reopen** has one **Reopen Comment**.
- A **Reopen Comment** belongs to the same **Case** being reopened.
- A **Case** links to a **Reopen Comment** by the persisted **Comment** identifier.
- An **Email Template** can opt into **Case Attachment Sending**.
- **Case Attachment Sending** applies only when template-based outbound email has **Case** context.
- An **Agenda** can have zero or more **Appointment Time Slots**.
- An **Appointment Time Slot** belongs to exactly one **Agenda**.
- An **Appointment Time Slot Capacity** must not exceed the **Agenda Daily Limit** for the owning **Agenda**.
- An **Interaction** can be related to zero or more **Cases**.
- A **Case** can be related to zero or more **Interactions**.
- A specific **Interaction** and **Case** can be related to each other at most once.
- An **Interaction** sender email may identify zero or more **Suggested Clients**.
- A **Suggested Client** comes from an exact match between the **Interaction** sender email and an active **Client** email address.
- Client contact email addresses do not identify **Suggested Clients** unless they are explicitly treated as **Client** email addresses.
- When the current agent begins reviewing an **Interaction** with a sender email, **Suggested Clients** are discovered without changing the **Selected Client** or interrupting general **Interaction** work.
- If no **Selected Client** exists, discovering **Suggested Clients** does not require an immediate agent decision; they are presented when the agent begins a client-dependent action.
- A change to the current **Interaction** or its sender email requires a new **Suggested Client** discovery.
- A failed **Suggested Client** discovery does not interrupt general **Interaction** work and may be retried when the agent begins a client-dependent action.
- A **Suggested Client** is not the **Selected Client** until the agent confirms the choice.
- Confirming a **Suggested Client** makes it the **Selected Client** for agent work; it does not assign the **Client** to the **Interaction**.
- A **User** is not a **Client**.
- A **User** is either an **Identity User** or a **Service User**.
- A **User** can have zero or more **User-Group Memberships** after historical creation paths; product **User** creation always establishes at least one **User-Group Membership**.
- A **User-Group Membership** links exactly one **User** to exactly one **Group**.
- A specific **User** and **Group** can have at most one **User-Group Membership**.
- A **User** has at most one **Active Group**.
- The **Active Group** of a **User**, when set, must be a **Group** for which that **User** has a **User-Group Membership**.
- Creating a **User** through the product create path creates the **User** and its initial **User-Group Memberships** together; a membership failure must not leave a newly created **User** without memberships.
- Changing **User-Group Memberships** after create is a separate operation from updating other **User** attributes.
- A **Selected Client Change Request** clears only the **Selected Client** and keeps the current **Interaction** and **Interaction Search Context**.
- A **Suggested Client Dismissal** does not change the current **Interaction**, **Interaction** search context, or **Selected Client**.

## Interaction-origin case creation

- In `/agent`, creating a **Case** from an **Interaction** uses only the currently selected **Client**. It does not infer the client from the interaction sender email.
- If there is no selected **Client**, the agent opens the client panel first and creates/selects the client before trying **New Case** again.
- If the **Interaction** sender email identifies a **Suggested Client**, the agent may explicitly confirm it before retrying **New Case**.
- If the **Interaction** sender email identifies no **Suggested Clients** while a **Selected Client** already exists, the agent must explicitly confirm whether to keep that **Selected Client** before using it for **Interaction**-origin case work.
- Confirming a **Suggested Client** does not continue **New Case** automatically.
- If there is a selected **Client**, **New Case** opens the case creation flow with the source `interaction_id`, and the created **Case** is related back to the source **Interaction** through `interaction_casos`.
- Showing **Cases** already related to the **Interaction** must not interrupt **New Case** when a selected **Client** is already available.
- Creating the **Case** and relating it to the **Interaction** are separate operations: a relation failure must not roll back the created **Case**.
- The `interaction_casos` association is part of agent interaction handling, so `/agent` users with `agente/interactions/InteractionsCreate` may create the relation.
- The public API route for the association is under the Interactions API base path: `/interactions/interaction-cases` (and `/interactions/interaction-cases/search` for reads). Calling root `/interaction-cases` hits the wrong custom-domain path.

## Interaction-origin case association

- In `/agent`, **Cases** already related to an **Interaction** are part of the **Interaction** context and may be shown without a selected **Client**.
- **Cases** already related to an **Interaction** should be presented with the **Interaction** context, while selected **Client** details remain separate client context.
- **Cases** already related to an **Interaction** should remain visible in the **Interaction** detail without interrupting the create or associate **Case** actions.
- In `/agent`, associating an existing **Case** from an **Interaction** uses only the currently selected **Client**.
- If there is no selected **Client**, the agent opens the client panel first and creates/selects the client before trying **Associate Case** again.
- If the **Interaction** sender email identifies a **Suggested Client**, the agent may explicitly confirm it before retrying **Associate Case**.
- Confirming a **Suggested Client** does not continue **Associate Case** automatically.
- Associating an existing **Case** from an **Interaction** is only available while the **Interaction** is open and under review by the current agent.
- By default, associating an existing **Case** from an **Interaction** offers only open **Cases**.
- Candidate **Cases** for association are part of the **Associate Case** action flow, not the inline list of **Cases** already related to the **Interaction**.
- The agent chooses from existing **Cases** for the selected **Client**, then the selected **Case** is related back to the source **Interaction** through `interaction_casos`.
- After a **Case** is associated to an **Interaction**, the agent remains in **Interaction** context and sees the related **Cases** refreshed there.

## Public error handling

- A **Public Error Response** has one **Public Error Code**.
- A **Public Error Code** does not replace the response's HTTP status.
- Detailed diagnostic information for a **Public Error Response** belongs in internal logs, not in the response body.
- A **Public Error Code Mirror** depends on the canonical **Public Error Code** registry and must not define independent meanings.

## Automation settings

- An **Automation Settings** configuration has exactly one **Automation Frequency**.
- An **Automation Settings** configuration is only eligible while the current date is within its active date range.

## Legacy compatibility

- Existing historical **Email** records may contain account references from an older mailbox model.
- New agent email send, reply, receive, and import records use **Email Account ID** as a **Channel Hub Account** reference.
- New agent email writes must not fall back to **Mail Account** resolution when a **Channel Hub Account** cannot be resolved.
- Reading existing **Email** records must not require old account references to be reinterpreted as **Channel Hub Accounts** unless a specific feature depends on that relationship.

## Example dialogue

> **Dev:** "When a **Channel Hub Account** receives an **Inbound Channel Hub Email**, do we only save the **Email**?"
> **Domain expert:** "No — the received message must be saved as an **Email** and opened as an **Interaction** in the correct **Workspace**."

## Flagged ambiguities

- "Channel Hub" was used for both account management and inbound email processing — resolved: **Channel Hub Account** is the external registration concept, while **Inbound Channel Hub Email** is the received customer message.
- "tags" in Channel Hub payloads is ambiguous with the configurable workspace tag — resolved: in inbound Channel Hub email routing, it carries a **Workspace Reference**, not the workspace's human-readable tag.
- "User" vs customer identity — resolved: **User** is a platform account; **Client** is the customer identity for support work.
- "account type" Identity vs Service — resolved: **Identity User** and **Service User**.
- "groups on create" as optional second API call — resolved: product **User** creation always creates initial **User-Group Memberships** with the **User**.
