# KACE Cloud - Architecture Documentation

**Version:** 2.0
**Last Updated:** 2026-08-27
**Status:** ✅ Validated against the `develop` branch

---

## Overview

This directory contains architecture documentation for **KACE Cloud**, an enterprise SaaS case/ticket management platform. The documentation follows the **C4 Model** (Context, Containers, Components, Code) for describing software architecture at different levels of abstraction.

> **Source of truth is the code, not this documentation.** Version 2.0 was produced by auditing every claim in version 1.0 against `develop`. Where the two disagreed, the code won. Counts in this README are reproducible with the commands given in the *Metrics* section.

### What is KACE Cloud?

KACE Cloud is a **multi-tenant serverless platform** built on AWS, designed to help organizations manage customer support, internal service desk, incident tracking, and workflow automation at scale.

**Key Characteristics:**
- **Architecture**: Serverless microservices (113 AWS Lambda packages) + one ECS worker for cron-style batch jobs
- **Frontend**: React 18.3 SPA with Redux Toolkit & TanStack Query
- **Backend**: Node.js 22 + Hexagonal Architecture + DDD
- **Database**: PostgreSQL 16 (multi-tenant, one schema per tenant, writer + read replica)
- **Async**: Domain events over SQS FIFO (one queue per bounded context) with an EventBridge archive
- **Infrastructure**: AWS (Lambda, API Gateway, ECS, SQS, EventBridge, S3, RDS/Aurora, Cognito, CloudFront, DynamoDB)
- **Repository**: Monorepo with pnpm workspaces
- **Scale**: 113 API packages + 86 core modules + 13 shared packages

---

## Documentation Structure

```
docs/architecture/
├── README.md (this file)
│
├── C4 Model Documentation
│   ├── c4-level-1-system-context.md       # High-level system view
│   ├── c4-level-2-containers.md           # Technical building blocks
│   └── c4-level-3-components.md           # Internal component structure
│
├── search-authorization.md                # Search authorization model
│
└── Architecture Decision Records (ADRs)
    ├── adr/README.md                      # ADR index
    └── adr/001…020-*.md                   # 10 accepted ADRs
```

There is currently **no `diagrams/` directory**. Sequence and deployment views live inline in the C4 documents (see *Container Communication Patterns* in Level 2 and *Data Flow Examples* in Level 3).

---

## C4 Model Documentation

The C4 Model provides a hierarchical way to visualize software architecture at different levels of abstraction:

### 📊 Level 1: System Context

**File:** [c4-level-1-system-context.md](c4-level-1-system-context.md)

**What it shows:**
- The big picture of KACE Cloud in its environment
- Users and actors (support agents, supervisors, admins, clients)
- External systems (AWS Cognito, Channel Hub, email services, Google APIs, Microsoft Graph, 3rd party REST)
- System boundaries and interactions

**Who should read this:**
- Executives & stakeholders
- Product managers
- Business analysts
- Anyone new to the project

---

### 📦 Level 2: Containers

**File:** [c4-level-2-containers.md](c4-level-2-containers.md)

**What it shows:**
- High-level technical building blocks and how they communicate
- Main containers:
  1. React SPA (Web Application, CloudFront + S3)
  2. API Gateway — **one REST API per microservice**, unified by a shared custom domain
  3. Lambda Microservices (113 deployable packages)
  4. @kace/core (Business Logic Package, 86 modules)
  5. SQS FIFO queues (one per bounded context) + DLQs
  6. Event Processor (6 SQS-triggered Lambdas)
  7. EventBridge bus (best-effort domain event archive)
  8. Actions Queue Worker (ECS on EC2, 2 services)
  9. PostgreSQL 16 (writer + reader)
  10. AWS S3 (one bucket per tenant)
  11. AWS DynamoDB (tenant registry)
- Communication patterns, deployment view, scalability and security characteristics

**Who should read this:**
- Software architects
- Tech leads
- Senior developers
- DevOps engineers

---

### 🧩 Level 3: Components

**File:** [c4-level-3-components.md](c4-level-3-components.md)

**What it shows:**
- Internal structure of the major containers, with real code from the repository
- Component breakdown:
  - **Lambda Microservice**: `handler.mjs` → one controller per endpoint → Use Cases → Repositories, with `BaseController.run()` as the single exit point
  - **@kace/core**: Domain / Application / Infrastructure layers across 86 modules, including domain events and event handlers
  - **React SPA**: Pages → Components → Hooks → Services → Redux State
  - **@kace/api-common**: multi-tenancy, DB routing, search authorization, object identity security
  - **Event Processor**: the six SQS consumers and the shared handler factory
- Detailed data flow examples (create case, inbound Channel Hub email)

**Who should read this:**
- Developers (all levels)
- Code reviewers
- New team members
- Anyone implementing features

---

## Architecture Decision Records (ADRs)

**Directory:** [adr/](adr/)

ADRs document **why** we made specific architectural decisions, the context, alternatives considered, and consequences.

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](adr/001-serverless-architecture-aws-lambda.md) | Serverless Architecture with AWS Lambda | ✅ Accepted |
| [ADR-002](adr/002-hexagonal-architecture-ddd.md) | Hexagonal Architecture and Domain-Driven Design | ✅ Accepted |
| [ADR-003](adr/003-multi-tenancy-postgresql-schemas.md) | Multi-Tenancy with PostgreSQL Schemas | ✅ Accepted |
| [ADR-004](adr/004-channel-hub-inbound-email-boundary.md) | Channel Hub Inbound Email Boundary | ✅ Accepted |
| [ADR-005](adr/005-public-error-response-contract.md) | Public Error Response Contract | ✅ Accepted |
| [ADR-006](adr/006-email-account-id-uses-channel-hub-accounts.md) | Email Account ID Uses Channel Hub Accounts | ✅ Accepted |
| [ADR-016](adr/016-workspace-channel-hub-account-cardinality.md) | Workspace Channel Hub Account Cardinality | ✅ Accepted |
| [ADR-017](adr/017-workspace-multiple-channel-hub-accounts.md) | Workspace Supports Multiple Channel Hub Accounts | ✅ Accepted |
| [ADR-018](adr/018-hide-system-inbox-workspace-from-frontend.md) | Hide the System Inbox Workspace from Frontend Choices | ✅ Accepted |
| [ADR-019](adr/019-agent-active-group-workspace-scope.md) | Enforce Agent Active-Group Workspace Scope | ✅ Accepted |
| [ADR-020](adr/020-public-error-code-catalog.md) | Public Error Code Catalog | ✅ Accepted |

Numbers 007–015 are unassigned.

### Decisions worth an ADR that are implemented but undocumented

These are live in the code with no ADR to explain the rationale:

- **GET/POST only** — `PUT`, `PATCH` and `DELETE` are forbidden by Information Security, enforced in `KApiStack`, `BaseController` and `Response`
- **SQS FIFO per bounded context as the event transport**, with EventBridge demoted to a best-effort archive (replaced the previous hybrid bus)
- **Read/write split with read-after-write consistency** (`DB_TARGET`, `DbRequestContext`)
- **One controller per endpoint**, with `run()` as the single exit point
- **ECS on EC2 for the actions queue worker** instead of Lambda

**See:** [adr/README.md](adr/README.md) for the complete index.

---

## Quick Start Guide

### For New Developers

1. **Start here:** [System Context](c4-level-1-system-context.md) — the big picture
2. **Then read:** [Containers](c4-level-2-containers.md) — the technical stack and how the pieces talk
3. **Deep dive:** [Components](c4-level-3-components.md) — the code structure and the real patterns
4. **Understand decisions:** read the [ADRs](adr/)
5. **Before writing code:** read `CLAUDE.md` at the repository root for conventions and gotchas

### For Architects

1. **Review:** all C4 levels
2. **Study:** ADRs for decision rationale
3. **Validate:** alignment with business requirements
4. **Propose:** new ADRs for significant changes

### For Stakeholders

1. **Read:** [System Context](c4-level-1-system-context.md) only
2. **Focus:** business capabilities and external integrations

---

## Key Architectural Principles

1. **Serverless-First**: leverage AWS managed services; use ECS only where a Lambda timeout cannot hold the workload
2. **Domain-Driven Design**: bounded contexts aligned with business domains, no barrel files, deep imports only
3. **Hexagonal Architecture**: clean separation between domain and infrastructure
4. **Multi-Tenancy**: strong data isolation via PostgreSQL schemas, tenant registry in DynamoDB
5. **Microservices**: independently deployable Lambda packages, one API Gateway REST API each
6. **Event-Driven**: async processing via SQS FIFO per bounded context, with DLQs and an EventBridge archive
7. **Read/Write Split**: reads served by the replica, with read-after-write consistency inside a request
8. **Infrastructure as Code**: AWS CDK for reproducible deployments
9. **GET and POST only**: writes are modelled as `POST` on a sub-resource
10. **Security-First**: Cognito auth, API keys for webhooks, WAF, search authorization policies, object identity hardening, SQL-injection guard as defense-in-depth
11. **Test-Driven**: 80% coverage threshold on `@kace/core`; integration tests hit real resources
12. **Stateless**: Lambda functions with external state (PostgreSQL, S3)

---

## Technology Stack

### Backend
- **Runtime**: Node.js 22 (`Runtime.NODEJS_22_X`)
- **Framework**: AWS Lambda + API Gateway REST (v1)
- **Architecture**: Hexagonal (Ports & Adapters) + DDD
- **Database**: PostgreSQL 16 (RDS / Aurora, optional RDS Proxy)
- **Query builder**: Knex.js 3.1
- **Async transport**: AWS SQS FIFO (hot path) + AWS EventBridge (archive)
- **Long-running jobs**: ECS on EC2
- **Storage**: AWS S3 (one bucket per tenant)
- **Auth**: AWS Cognito + JWT; API Key + Usage Plan for the public webhook
- **Testing**: Jest (80% threshold on `@kace/core`)

### Frontend
- **Framework**: React 18.3
- **Build Tool**: Vite 6
- **State Management**: Redux Toolkit 2.3 (UI) + TanStack Query v5 (server)
- **UI Library**: Radix UI + Tailwind CSS 3.4
- **HTTP Client**: Axios 1.7
- **Forms**: React Hook Form + Joi 17
- **Testing**: Vitest

### Infrastructure
- **Cloud**: AWS (Lambda, API Gateway, ECS, SQS, EventBridge, S3, RDS, DynamoDB, Cognito, CloudFront, WAF)
- **IaC**: AWS CDK 2.x (TypeScript)
- **CI/CD**: GitHub Actions (`.github/workflows/`: `ci.yml`, `nightly-core.yml`, `pin-lint.yml`, `branch-naming.yml`, `worker-image.yml`)
- **Monitoring**: CloudWatch Logs/Metrics/Alarms
- **Package Manager**: pnpm 10.11.0

---

## Metrics & Statistics

| Metric | Value | How to verify |
|--------|-------|---------------|
| **Lambda packages** | 113 deployable (111 with `cdk:deploy`) | `ls -1 apps/apiv1 \| wc -l` (114 dirs; `kace_cloud_api_auth` has no `package.json`) |
| **Event-processor Lambdas** | 6 (from 1 package) | `ls apps/apiv1/kace_cloud_api_event_processor/src` |
| **ECS worker services** | 2 (`fast`, `ans`) | `apps/workers/.../lib/*-stack.ts` |
| **@kace/core modules** | 86 | `ls -1 packages/kace_cloud_core/src \| wc -l` |
| **Shared packages** | 13 | `ls -1 packages \| wc -l` |
| **Frontend pages** | 50 | `ls -1 apps/kace-saas/src/pages \| wc -l` |
| **Reusable core components** | 31 | `ls -1 apps/kace-saas/src/components/core \| wc -l` |
| **Custom hooks** | 33 | `ls -1 apps/kace-saas/src/hooks \| grep -v -E '\.(spec\|test)\.' \| wc -l` |
| **Redux slices** | 13 | `ls -1 apps/kace-saas/src/redux/state \| wc -l` |
| **Frontend API services** | 14 | `ls -1 apps/kace-saas/src/services` |
| **Database migrations** | 325 | `ls -1 packages/kace_cloud_database/migrations \| wc -l` |
| **Distinct tables** | 113 | `grep -rho "createTable(['\"][a-z_]*" packages/kace_cloud_database/migrations \| sort -u \| wc -l` |
| **SQS queues** | 6 + 6 DLQs | `apps/apiv1/kace_cloud_api_event_processor/lib/event-processor-stack.ts` |
| **Code coverage threshold** | 80% | `packages/kace_cloud_core/jest.config.js` |
| **Deployment concurrency** | 5 (`pnpm deploy`) / 15 (`pnpm deploy:15`) | root `package.json` |

---

## Related Documentation

### Repository Documentation
- `CLAUDE.md` (repository root) — developer guide, code conventions and known gotchas
- [search-authorization.md](search-authorization.md) — search authorization model
- `packages/kace_cloud_core/tests/README.md` — how the parallel test suite works

---

## Diagrams Legend

Throughout this documentation, we use these symbols:

```
┌─────┐
│ Box │  = Container, Component, or System
└─────┘

  │
  ▼     = Data flow or dependency direction

[Component]  = Software component
⚠            = Known footgun / operational hazard
```

---

## Maintenance

### How to Update This Documentation

1. **C4 documents**: update the markdown when the architecture changes, and re-run the verification commands in the *Metrics* table
2. **ADRs**: create a new ADR for significant decisions
3. **Index**: update this README when adding new documents
4. **Review**: quarterly architecture review

### Documentation Drift Policy

Version 1.0 of these documents drifted far enough from the code to be actively misleading (it described a RabbitMQ broker that does not exist, and `PUT`/`DELETE` routes that the platform forbids). To avoid a repeat:

- **Never restate a count without the command that produces it.** Every number in this documentation is accompanied by a way to check it.
- **Never document an example that is not copied from real code.** Illustrative pseudo-code drifts silently; real code fails review when it goes stale.
- **Mark "future" items with the file that would have to change.** An unimplemented feature described without a hook into the codebase becomes indistinguishable from an implemented one.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-06 | Initial C4 Model documentation + core ADRs |
| 2.0 | 2026-08-27 | Full audit against `develop`. Replaced the RabbitMQ container with SQS FIFO + EventBridge; corrected the HTTP method policy to GET/POST only; documented the ECS worker, the event processor, the read/write split, the search-authorization and object-identity components; corrected every count; fixed the API Gateway topology (one REST API per service) and the S3 bucket model (one per tenant); removed references to the non-existent `diagrams/` directory and rebuilt the ADR index. |

---

## Appendix

### Glossary

- **ADR**: Architecture Decision Record
- **Aggregate**: DDD pattern for transactional boundaries
- **ANS**: *Acuerdo de Nivel de Servicio* — the Spanish term used throughout the codebase for SLA
- **Bounded Context**: DDD pattern for domain boundaries
- **C4**: Context, Containers, Components, Code (architecture visualization)
- **Channel Hub**: Konecta's omnichannel platform; delivers inbound email to KACE by webhook
- **DDD**: Domain-Driven Design
- **DLQ**: Dead Letter Queue
- **DTO**: Data Transfer Object
- **IaC**: Infrastructure as Code
- **Reader / Writer**: the two PostgreSQL endpoints; `DB_TARGET` decides which one a service reads from
- **Use Case**: application layer pattern for business operations

### Acronyms

- **AMQP**: Advanced Message Queuing Protocol (*not used* — kept here only because older documents referenced it)
- **API**: Application Programming Interface
- **AWS**: Amazon Web Services
- **CDK**: Cloud Development Kit
- **CQRS**: Command Query Responsibility Segregation
- **FIFO**: First In, First Out (SQS queue type used for domain events)
- **JWT**: JSON Web Token
- **RBAC**: Role-Based Access Control
- **RDS**: Relational Database Service
- **SPA**: Single-Page Application
- **SQS**: Simple Queue Service
- **WAF**: Web Application Firewall

---

**Document Status:** ✅ Validated against `develop`
**Next Review:** 2026-11-27 (Quarterly)
**Owner:** Architecture Team
