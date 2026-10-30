# ADR-019: Enforce Agent Active-Group Workspace Scope

**Status:** Accepted

**Date:** 2026-07-31

## Context

Administrators may intentionally create or retain a Workspace without assigning it to a
Group. Existing Agent discovery treated such Workspaces as globally available, and the
general interaction APIs did not distinguish an Agent's active Group from administrator
or integration access. That allowed Agent views and direct requests to cross the intended
operational boundary.

The general APIs also serve administrators and trusted internal operations, which need to
retain cross-Group access. Group relationship changes must affect Agent eligibility without
deleting or reassigning Workspaces, Interactions, or other dependent records.

## Decision

A Workspace may have zero or more Group relationships. Administrators may create a
Workspace without Groups and may remove its final Group relationship during an update.

Agent-specific Workspace and Interaction APIs enforce Active-Group Workspace Scope on the
server. The scope is derived from the authenticated User, that User's persisted active
Group and membership, an active and retained Group, an active and retained Workspace, and
the Workspace-Group relationship. Request filters can narrow this scope but cannot remove
or broaden it. Authorization-bearing scope reads use the writer so a stale replica cannot
re-expose a recently removed relationship.

Agent interaction search and count use explicit Agent routes and the same mandatory scope
predicate. Agent close, review claim or release, move sources, case association, and
linked-case read routes return a generic not-found result for nonexistent or out-of-scope
Interaction identifiers. Bulk actions validate every source before writing.

Moving an Interaction is the narrow exception for destination eligibility. Once the source
Interaction is validated inside the Agent's Active-Group Workspace Scope, its destination
may be any active, retained tenant Workspace except the Interaction's current Workspace and
the canonical System Inbox Workspace. The destination does not need to be in the Agent's
Active-Group Workspace Scope. If it is outside that scope, the successful move immediately
removes the Interaction from that Agent's search, count, direct-read, and action eligibility.
This exception does not broaden general Agent Workspace discovery or any other Agent action.

Existing administrator and trusted internal routes remain unchanged and cross-Group. No
legacy record cleanup, migration, deletion, reassignment, activation rule, or Group
lifecycle invariant is introduced.

The System Inbox Workspace remains governed independently by ADR-018. Its canonical-ID
frontend concealment, exclusion from Agent move destinations, and backend operational
fallback are not replaced by Group scope.

## Consequences

- Agent "All Workspaces" means all Workspaces in the authenticated User's Active-Group
  Workspace Scope, not every Workspace in the tenant.
- Group-Unassigned and other-Group Workspaces and their Interactions remain manageable by
  administrators but are unavailable through Agent discovery, direct routes, and actions,
  except that an in-scope Interaction may be moved to such an active, retained Workspace.
- Agent move destination discovery is limited to the move capability and includes active,
  retained tenant Workspaces outside Active-Group Workspace Scope, including eligible
  Group-Unassigned Workspaces; it excludes the current and canonical System Inbox Workspaces.
- A move outside Active-Group Workspace Scope succeeds but immediately makes the moved
  Interaction unavailable to that Agent.
- Removing the final matching Group relationship immediately removes existing Interactions
  from Agent scope without changing their Workspace reference; adding a relationship makes
  them eligible for Agents in that active Group.
- Route-specific Agent APIs preserve existing administrator and internal behavior but
  require every Agent-facing frontend surface to use the scoped route.
- The move-destination exception does not change administrator or trusted internal behavior,
  Workspace-Group relationships, zero-Group Workspace eligibility, or existing records.
- Writer-backed Agent authorization consumes writer capacity in exchange for avoiding
  replica-lag authorization gaps.

## Alternatives Considered

- Treat Group-Unassigned Workspaces as globally available. Rejected because an absent
  assignment must not grant every Agent access.
- Add client-side Group filters to the existing APIs. Rejected because URL, saved state,
  or direct API calls could omit or alter them and counts could diverge from rows.
- Apply the restriction to every Workspace and Interaction API. Rejected because it would
  change administrator and trusted internal behavior beyond the Agent requirement.
- Delete or migrate Group-Unassigned Workspaces. Rejected because visibility is an access
  concern and existing records and dependencies must be preserved.
- Restrict Agent move destinations to Active-Group Workspace Scope. Rejected because the
  approved move capability intentionally permits transfer to any eligible active, retained
  tenant Workspace while removing subsequent Agent access when the destination is out of scope.

## Related ADRs

- [ADR-018: Hide the System Inbox Workspace from Frontend Choices](018-hide-system-inbox-workspace-from-frontend.md)
