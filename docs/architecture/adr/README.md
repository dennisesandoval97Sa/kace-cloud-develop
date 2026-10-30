# Architecture Decision Records (ADR)

This directory contains Architecture Decision Records (ADRs) documenting the key architectural decisions made for the KACE Cloud platform.

## What is an ADR?

An Architecture Decision Record (ADR) is a document that captures an important architectural decision made along with its context and consequences. ADRs help teams:

- Understand the rationale behind past decisions
- Avoid revisiting settled debates
- Onboard new team members faster
- Document trade-offs and alternatives considered

## ADR Format

Each ADR follows this structure:

- **Status**: Accepted, Deprecated, Superseded, or Rejected
- **Date**: When the decision was made
- **Context**: The problem and requirements
- **Decision**: What was decided and how it's implemented
- **Consequences**: Positive and negative outcomes
- **Alternatives Considered**: What else was evaluated
- **Related ADRs**: Cross-references

---

## Index of ADRs

### Core Architecture Decisions

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](001-serverless-architecture-aws-lambda.md) | Serverless Architecture with AWS Lambda | Accepted | 2023-Q1 |
| [ADR-002](002-hexagonal-architecture-ddd.md) | Hexagonal Architecture and Domain-Driven Design | Accepted | 2023-Q1 |
| [ADR-003](003-multi-tenancy-postgresql-schemas.md) | Multi-Tenancy with PostgreSQL Schemas | Accepted | 2023-Q1 |
| [ADR-004](004-channel-hub-inbound-email-boundary.md) | Channel Hub Inbound Email Boundary | Accepted | 2026-06-12 |
| [ADR-005](005-public-error-response-contract.md) | Public Error Response Contract | Accepted (catalog clauses superseded by ADR-020) | 2026-06-17 |
| [ADR-006](006-email-account-id-uses-channel-hub-accounts.md) | Email Account ID Uses Channel Hub Accounts | Accepted | 2026-06-23 |
| [ADR-016](016-workspace-channel-hub-account-cardinality.md) | Workspace Channel Hub Account Cardinality | Superseded by ADR-017 | 2026-06-24 |
| [ADR-017](017-workspace-multiple-channel-hub-accounts.md) | Workspace Supports Multiple Channel Hub Accounts | Accepted | 2026-07-01 |
| [ADR-018](018-hide-system-inbox-workspace-from-frontend.md) | Hide the System Inbox Workspace from Frontend Choices | Accepted | 2026-07-30 |
| [ADR-019](019-agent-active-group-workspace-scope.md) | Enforce Agent Active-Group Workspace Scope | Accepted | 2026-07-31 |
| [ADR-020](020-public-error-code-catalog.md) | Public Error Code Catalog | Accepted | 2026-08-13 |
| [ADR-021](021-channel-hub-workspace-processing-order.md) | Channel Hub Owns Workspace Processing Order | Accepted | 2026-07-21 |

### Infrastructure Decisions

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| ADR-007 | Monorepo with pnpm Workspaces | Planned | - |
| ADR-008 | AWS CDK for Infrastructure as Code | Planned | - |

### Frontend Decisions

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| ADR-009 | React SPA with Redux + TanStack Query | Planned | - |
| ADR-010 | Vite as Build Tool | Planned | - |

### Backend Decisions

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| ADR-011 | Knex.js as ORM | Planned | - |
| ADR-012 | Node.js 22 as Runtime | Planned | - |

### Integration Decisions

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| ADR-013 | RabbitMQ for Async Processing | Planned | - |
| ADR-014 | AWS Cognito for Authentication | Planned | - |
| ADR-015 | S3 Presigned URLs for File Uploads | Planned | - |

---

## ADR Lifecycle

- **Proposed**: ADR draft under discussion
- **Accepted**: Decision approved and implemented
- **Deprecated**: No longer recommended but still in use
- **Superseded**: Replaced by a newer ADR
- **Rejected**: Proposed but not accepted

---

## How to Create a New ADR

1. Copy the template: `cp adr-template.md XXX-title.md`
2. Fill in all sections (context, decision, consequences)
3. Submit for review via pull request
4. Update this README.md index after approval

---

## Related Documentation

- [C4 Model - Level 1: System Context](../c4-level-1-system-context.md)
- [C4 Model - Level 2: Containers](../c4-level-2-containers.md)
- [C4 Model - Level 3: Components](../c4-level-3-components.md)
- [Main Architecture Documentation](../README.md)

---

**Last Updated:** 2026-07-31
**Maintained By:** Roberto Garcia
