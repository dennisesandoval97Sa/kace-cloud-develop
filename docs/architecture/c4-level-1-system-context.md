# C4 Model - Level 1: System Context

## Overview

This document describes the **System Context** for KACE Cloud, showing the big picture of how the system fits into the wider enterprise IT ecosystem and identifying key actors and external systems.

> **Source of truth:** this document is validated against the code in `develop`, not against prior documentation. Every count and technology claim below is traceable to a file in the monorepo.

## System Landscape Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          KACE Cloud System                          │
│                   Enterprise SaaS Case Management                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    React SPA Frontend                       │    │
│  │        (Browser-based application, CloudFront + S3)         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                      │
│                              │ HTTPS/REST + JWT                     │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │       AWS API Gateway (one REST API per microservice)       │    │
│  │       + Cognito User Pool Authorizer (JWT validation)       │    │
│  │       + API Key + Usage Plan (public webhook path)          │    │
│  │       + WAF Web ACL (staging / production only)             │    │
│  │       + Shared custom domain via BasePathMapping            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                      │
│  ┌───────────────────────────┴───────────────────────────────┐      │
│  │          113 AWS Lambda Microservices (apps/apiv1)        │      │
│  │              Serverless request/response backend          │      │
│  └───────────────────────────┬───────────────────────────────┘      │
│                              │                                      │
│         publishes domain events (SQS FIFO, hot path)                │
│         + best-effort archive copy (EventBridge)                    │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │   Event Processor (6 SQS-triggered Lambdas, 1 per BC)       │    │
│  │   cases · action-jobs · automated-actions · ws-rest ·       │    │
│  │   case-post-processing · reports                            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │   Actions Queue Worker (ECS on EC2, 2 long-running tasks)   │    │
│  │   Cron-style jobs: actions queue, ANS recalculation,        │    │
│  │   automated assignment, user/group actions                  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                      │
│        ┌─────────────────────┼─────────────────────┐                │
│        ▼                     ▼                     ▼                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐           │
│  │  PostgreSQL  │  │   AWS S3     │  │   AWS DynamoDB   │           │
│  │   16 (RDS/   │  │  Storage     │  │ Tenant registry  │           │
│  │   Aurora)    │  │ (1 bucket    │  │ (DB hosts, queue │           │
│  │  Writer +    │  │  per tenant) │  │  URLs, S3 bucket,│           │
│  │  Reader      │  │              │  │  per tenant)     │           │
│  │  (schema     │  │              │  │                  │           │
│  │  per tenant) │  │              │  │                  │           │
│  └──────────────┘  └──────────────┘  └──────────────────┘           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         People (Actors)                             │
│                                                                     │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │
│  │ Support Agents │  │   Supervisors  │  │ Administrators │         │
│  │ (End Users)    │  │   (Managers)   │  │  (IT Staff)    │         │
│  │                │  │                │  │                │         │
│  │ - Create cases │  │ - Monitor      │  │ - Configure    │         │
│  │ - Assign work  │  │   performance  │  │   system       │         │
│  │ - Resolve      │  │ - Generate     │  │ - User         │         │
│  │   tickets      │  │   reports      │  │   management   │         │
│  │ - Communicate  │  │ - Manage       │  │ - Workflow     │         │
│  │   with clients │  │   teams        │  │   design       │         │
│  └────────────────┘  └────────────────┘  └────────────────┘         │
│                                                                     │
│  ┌────────────────┐                                                 │
│  │    Clients     │                                                 │
│  │  (Customers)   │                                                 │
│  │                │                                                 │
│  │ - Submit cases │                                                 │
│  │ - Track status │                                                 │
│  │ - Communicate  │                                                 │
│  └────────────────┘                                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      External Systems                               │
│                                                                     │
│  ┌──────────────────────┐  ┌──────────────────────┐                 │
│  │   AWS Cognito        │  │   AWS S3             │                 │
│  │  (Authentication)    │  │  (Direct File Upload)│                 │
│  │                      │  │                      │                 │
│  │ - User pool          │  │ - Presigned URLs     │                 │
│  │ - OAuth 2.0 / OIDC   │  │ - Temporary          │                 │
│  │ - JWT tokens         │  │   credentials        │                 │
│  │ - MFA                │  │ - Browser upload     │                 │
│  └──────────────────────┘  └──────────────────────┘                 │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Channel Hub (Konecta omnichannel platform)                  │   │
│  │                                                              │   │
│  │  - Registers KACE email identities (Channel Hub Accounts)    │   │
│  │  - Delivers INBOUND customer email as an API-key webhook     │   │
│  │    to POST /webhooks/channel-hub  (see ADR-004)              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────┐  ┌──────────────────────┐                 │
│  │   Email Services     │  │   Google APIs        │                 │
│  │  (SMTP)              │  │  (Gmail)             │                 │
│  │                      │  │                      │                 │
│  │ - Nodemailer         │  │ - Gmail API          │                 │
│  │ - Email sending      │  │ - Email reading      │                 │
│  │ - Email templates    │  │ - OAuth integration  │                 │
│  └──────────────────────┘  └──────────────────────┘                 │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Microsoft Graph + Azure MSAL                                │   │
│  │  (Outlook )                                                  │   │
│  │                                                              │   │
│  │  - Outlook email reading                                     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────┐  ┌──────────────────────┐                 │
│  │   3rd Party APIs     │  │   Webhook Receivers  │                 │
│  │  (REST Integration)  │  │  (External Systems)  │                 │
│  │                      │  │                      │                 │
│  │ - WS REST flows      │  │ - Event callbacks    │                 │
│  │ - External actions   │  │ - Status updates     │                 │
│  └──────────────────────┘  └──────────────────────┘                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## System Context

### KACE Cloud System

**Description:** Enterprise SaaS platform for case/ticket management, designed to help organizations manage customer support, internal service desk, incident tracking, and workflow automation at scale.

**Type:** Web Application

**Technology:** React 18.3 SPA + AWS Serverless Backend (Lambda + API Gateway) + one ECS worker for cron-style batch jobs

**Users:**
- Support agents (primary users)
- Supervisors & managers
- System administrators
- End customers (clients)

**Key Capabilities:**
- **Case Management**: Create, assign, track, and resolve customer support cases
- **Multi-Tenant**: Isolated data and configuration per organization
- **Workflow Automation**: Automated actions, state transitions, SLA monitoring
- **Reporting & Analytics**: Real-time dashboards, custom reports, KPI tracking
- **Integration Hub**: Email (Channel Hub, Gmail, Microsoft Graph, SMTP), REST APIs, webhooks
- **Classification System**: Hierarchical categorization with templates
- **File Management**: Document attachments, cloud storage
- **User & Group Management**: Role-based access control (RBAC) plus per-search authorization policies
- **Notifications**: User alerts, client communications
- **Scheduling**: Appointments, agendas, resource booking

### People (Actors)

#### Support Agents (Primary Users)
**Count:** 1-1000 per tenant

**Use Cases:**
- Create new cases from client requests
- Assign cases to self or team members
- Add descriptions, comments, attachments
- Transition cases through workflow states
- Communicate with clients via notifications
- Update case details and custom fields
- Track time spent on cases
- Search and filter cases

**Access Level:** Standard user with RBAC permissions

#### Supervisors / Managers
**Count:** 1-1000 per tenant

**Use Cases:**
- Monitor team performance and SLA compliance
- Generate reports and analytics
- Reassign cases for load balancing
- Review escalated cases
- Configure team workflows and priorities
- Manage group assignments

**Access Level:** Elevated permissions for reporting and team management

#### System Administrators
**Count:** 1-1000 per tenant

**Use Cases:**
- Configure system settings (classifications, states, workflows)
- Manage users, groups, roles, and permissions
- Define automated actions and business rules
- Create case templates
- Configure integrations (email, APIs, webhooks)
- Set up custom fields (auxiliaries)
- Monitor system health and audit logs
- Manage tenant configuration

**Access Level:** Full administrative access

#### Clients (End Customers)
**Count:** NO LIMIT per tenant

**Use Cases:**
- Submit new case requests
- Track case status
- Receive notifications on case updates
- Provide additional information
- View case history

**Access Level:** Limited read-only access to own cases (via client portal or notifications)

### External Systems

#### AWS Cognito (Authentication Provider)
**Purpose:** User authentication and authorization

**Integration:**
- OAuth 2.0 / OpenID Connect
- JWT token issuance
- User pool management
- Multi-factor authentication (MFA)
- Social identity providers

**Communication:** HTTPS REST API

**Used By:** React SPA, API Gateway Cognito User Pool Authorizer

**Note:** Cognito is the identity provider, but it is not the only authentication concern in the platform. KACE additionally owns a **server-side session** (`usuarios.session_key`, rotated by `BaseController` on every request) used to enforce single-session semantics for Active Directory users, and the public webhook path authenticates with an **API Key + Usage Plan** instead of Cognito.

#### AWS S3 (Cloud Storage)
**Purpose:** File storage for case attachments, email bodies and attachments, templates, exports

**Integration:**
- Presigned URLs for direct browser upload/download
- Server-side encryption
- **One bucket per tenant**, resolved at runtime from the tenant aggregate (`tenant.aws_s3_bucket`), with `AWS_S3_BUCKET` as the environment fallback

**Communication:** AWS SDK, HTTPS

**Used By:** Lambda S3 services, email storage services, React file upload components

#### Channel Hub (Konecta omnichannel platform)
**Purpose:** Registers KACE email identities and delivers inbound customer email into KACE

**Integration:**
- `api_channel_hub` owns Channel Hub Account CRUD + registration
- Inbound email arrives as an HTTP webhook on `POST /webhooks/channel-hub`, authenticated with an API Key (the webhooks service disables the Cognito authorizer for this path)
- The controller stays thin and delegates to a dedicated `@kace/core` inbound-email use case (`ChannelHubInboundEmailProcessor`)
- `/interactions/webhook` remains a temporary compatibility adapter

**Communication:** HTTPS POST with `x-api-key`

**Reference:** ADR-004, ADR-006, ADR-016, ADR-017

#### Email Services (SMTP)
**Purpose:** Send emails related to cases

**Integration:**
- Nodemailer for sending
- Email templates

**Communication:** SMTP

**Used By:** Notification services, email integration modules

#### Google Gmail API
**Purpose:** Gmail inbox integration for case creation from emails

**Integration:**
- `@googleapis/gmail` client
- OAuth 2.0 authentication
- Email reading and parsing

**Communication:** HTTPS REST API

**Used By:** Email integration modules in `@kace/core`

#### Microsoft Graph + Azure MSAL
**Purpose:** Outlook

**Integration:**
- `@microsoft/microsoft-graph-client`
- Azure AD authentication (`@azure/msal-node`)
- Email access

**Communication:** HTTPS REST API

**Used By:** Email integration modules

#### 3rd Party REST APIs
**Purpose:** External system integrations via WS REST flows

**Integration:**
- Custom REST endpoints
- Workflow steps (WS REST)
- Configurable request/response mapping

**Communication:** HTTPS REST

**Used By:** WS REST flow engine, action executor

#### Webhook Receivers (External Systems)
**Purpose:** Receive event notifications from KACE Cloud

**Integration:**
- Webhook definitions
- Event-driven triggers
- Configurable payloads

**Communication:** HTTPS POST

**Used By:** Action executor, event processing

## Key Interactions

### User → KACE Cloud
1. **User Authentication**
   - User accesses React SPA → Redirected to AWS Cognito
   - Cognito authenticates → Returns JWT token
   - SPA stores token → Uses for API requests
   - KACE rotates the server-side `session_key` and returns it as a session cookie

2. **Case Creation**
   - Agent submits case form → `POST /cases`
   - API Gateway validates token → Routes to Lambda
   - Lambda creates case → Stores in PostgreSQL (writer)
   - Lambda publishes `kace.core.case.created` to the cases SQS FIFO queue
   - Returns case details → Updates React UI
   - Asynchronously, the event-processor Lambda runs automated actions and post-processing

3. **File Upload**
   - User selects file → Requests presigned URL
   - Lambda generates S3 presigned URL → Returns to browser
   - Browser uploads directly to S3 → Notifies Lambda
   - Lambda creates S3File record → Updates case

### KACE Cloud → External Systems
1. **Email Integration (Inbound)**
   - Channel Hub receives the customer email → POSTs to `/webhooks/channel-hub`
   - The webhook Lambda validates the API key and the tenant → delegates to the core inbound-email use case
   - Creates Email + Email Body + Attachments + Interaction → stores bodies/attachments in S3, metadata in PostgreSQL
   - (Gmail / Microsoft Graph polling exists as an alternative ingestion path)

2. **Email Notifications (Outbound)**
   - Case updated → Triggers notification action
   - Lambda composes email → Sends via Nodemailer
   - SMTP server delivers → Client receives

3. **Webhook Callbacks**
   - Action executed → Triggers webhook
   - Lambda sends HTTP POST → External system endpoint
   - External system processes → Returns response
   - Lambda logs result

4. **REST API Workflow**
   - `kace.core.ws_rest_flow_execution.requested` is published to the ws-rest queue
   - The ws-rest event-processor Lambda consumes it and calls the external REST API
   - Receives response → Maps to case fields
   - Updates case state

## System Boundaries

### Inside the System
- React SPA frontend (CloudFront + S3, its own CDK stack)
- AWS API Gateway (one REST API per microservice) + Cognito authorizer + API-key webhook path
- 113 Lambda microservices (`apps/apiv1`), of which 6 are SQS-triggered event processors
- Actions Queue Worker on ECS/EC2 (`apps/workers`)
- `asistencia_notificaciones_robotica` scheduled notification service
- PostgreSQL 16 (multi-tenant, schema per tenant, writer + reader endpoints)
- SQS FIFO queues (one per bounded context) + dead-letter queues
- EventBridge bus (best-effort archive of every domain event)
- DynamoDB tenant registry
- AWS S3 file storage (metadata in DB)

### Outside the System (External Dependencies)
- AWS Cognito (authentication)
- Channel Hub (inbound email delivery)
- Email servers (SMTP, Gmail API, Microsoft Graph)
- 3rd party REST APIs
- Webhook endpoints
- AWS CloudWatch (monitoring)
- AWS CloudFront (CDN)

## Non-Functional Characteristics

| Characteristic | Implementation |
|---|---|
| **Scalability** | Auto-scaling Lambda functions, per-BC SQS queues with reserved concurrency, RDS/Aurora read replica |
| **Availability** | Multi-AZ deployment, Lambda retries, SQS redrive to DLQ (`maxReceiveCount: 3`), RDS failover |
| **Security** | Cognito auth, JWT tokens, API keys for webhooks, encrypted data at rest/in transit, WAF (staging/prod), SQL-injection guard, search-authorization policies, object-identity authorization |
| **Multi-Tenancy** | Separate PostgreSQL schemas per tenant, tenant registry in DynamoDB, `withTenantContext` + `AsyncLocalStorage` isolation |
| **Performance** | CloudFront CDN, Lambda memory tuning, DB indexes, LRU tenant cache, read/write split with read-after-write consistency |
| **Compliance** | Audit logs, role-based access control, search audit logging, data encryption |
| **Observability** | CloudWatch logs, metrics, per-queue depth alarms, event logs |
| **Reliability** | Serverless redundancy, SQS FIFO persistence + DLQs, DB backups |

## Technology Constraints

- **Cloud Provider:** AWS only (Lambda, API Gateway, ECS, SQS, EventBridge, S3, RDS/Aurora, Cognito, CloudFront, DynamoDB)
- **Runtime:** Node.js 22 for backend (`Runtime.NODEJS_22_X`)
- **Database:** PostgreSQL 16 (no NoSQL migration planned; DynamoDB is used only for the tenant registry). SQLite is deprecated and being removed.
- **HTTP methods:** only `GET` and `POST` are authorized by Information Security. `PUT`, `PATCH` and `DELETE` are forbidden in API Gateway routes, in CORS configuration and in frontend clients.
- **Browser Support:** Modern browsers (Chrome, Firefox, Safari, Edge)
- **Authentication:** AWS Cognito for interactive users; API Key + Usage Plan for the public webhook path

## Future External Integrations (Planned)

- Salesforce integration
- WhatsApp Business API

---

**Document Status:** ✅ Validated against `develop`
**Last Updated:** 2026-08-27
**Version:** 2.0
**Author:** [Roberto Garcia](mailto:roberto.garcia@konecta-group.com)
