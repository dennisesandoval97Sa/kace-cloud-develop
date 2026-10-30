# ADR-001: Serverless Architecture with AWS Lambda

**Status:** ✅ Accepted

**Decision Makers:** Corporate Architecture Team

---

## Context

KACE Cloud is an enterprise SaaS case management platform that needs to:
- Handle variable workloads (spikes during business hours, low traffic at night)
- Scale automatically without manual intervention
- Minimize operational overhead (no server management)
- Optimize costs (pay-per-use instead of fixed infrastructure)
- Deploy independently deployable microservices
- Support rapid feature development and deployment

Traditional server-based architectures (EC2, containers) require:
- Capacity planning and over-provisioning
- Manual scaling configuration
- Server maintenance and patching
- Fixed costs regardless of usage
- Complex load balancer configuration

---

## Decision

We will adopt a **serverless architecture using AWS Lambda** as the primary compute platform for all backend microservices.

### Architecture Components

1. **AWS Lambda Functions**: 100 microservices, each as a separate Lambda
2. **API Gateway**: REST API interface with Cognito authorization
3. **Event-Driven Processing**: RabbitMQ for async workflows
4. **Managed Services**: RDS PostgreSQL, S3, Cognito, CloudWatch

### Implementation Details

- **Runtime**: Node.js 22 (latest LTS)
- **Memory**: 256-512 MB per function
- **Timeout**: ~30 seconds
- **Deployment**: AWS CDK (Infrastructure as Code)
- **Module System**: ECMAScript Modules (.mjs)

---

## Consequences

### ✅ Positive

1. **Auto-Scaling**
   - Lambda scales automatically from 0 to 1000+ concurrent executions per function
   - No capacity planning required
   - Handles traffic spikes seamlessly

2. **Cost Optimization**
   - Pay-per-request model (first 1M requests free, $0.20 per 1M thereafter)
   - Pay-per-compute-time (GB-second pricing)
   - No cost for idle time (vs. always-on servers)
   - Estimated 60-70% cost savings vs. EC2/ECS

3. **Operational Simplicity**
   - No server management, patching, or OS updates
   - Managed by AWS (high availability, fault tolerance)
   - Built-in logging to CloudWatch
   - Automatic retries and error handling

4. **Development Velocity**
   - Independent deployment per microservice
   - Smaller deployment units (faster CI/CD)
   - Isolated changes (one Lambda per domain)
   - AWS CDK enables fast infrastructure provisioning

5. **High Availability**
   - Multi-AZ deployment by default
   - Automatic failover
   - No single point of failure

6. **Security**
   - IAM role-based permissions per function
   - VPC isolation (optional)
   - Encrypted environment variables
   - AWS managed security updates

### ❌ Negative

1. **Cold Starts**
   - First invocation after idle period can take 1-3 seconds
   - **Mitigation**:
     - Use 256+ MB memory allocation (faster cold starts)
     - Minimize dependencies in handler files
     - Keep Lambda "warm" with scheduled pings (if needed)
     - Accept 1-3 second delay for infrequent endpoints

2. **Execution Time Limits**
   - Maximum 15 minutes per invocation (AWS limit)
   - Our timeout: ~30 seconds
   - **Mitigation**:
     - Long-running tasks offloaded to RabbitMQ queue
     - Actions Queue Executor for batch processing
     - Async workflows for heavy operations

3. **Debugging Complexity**
   - Distributed tracing across 100+ functions
   - **Mitigation**:
     - Structured logging with CloudWatch Insights
     - Correlation IDs for request tracking
     - X-Ray integration (future)
     - Helper.logInfo() and Helper.logDebug() utilities

4. **Vendor Lock-In**
   - Tightly coupled to AWS ecosystem
   - **Mitigation**:
     - Business logic abstracted in @kace/core (portable)
     - Hexagonal architecture (ports & adapters)
     - Repository pattern isolates data access
     - Could migrate to Azure Functions, Google Cloud Functions (with effort)

5. **State Management**
   - Lambda functions are stateless
   - **Mitigation**:
     - State stored in PostgreSQL (persistent)
     - Redis cache for session data (future)
     - TenantContext via AsyncLocalStorage (per-request)

6. **Local Development**
   - Cannot run Lambda locally without emulation
   - **Mitigation**:
     - AWS SAM Local (Docker-based emulation)
     - Unit tests run without Lambda runtime
     - Integration tests use LocalStack (future)

---

## Alternatives Considered

### 1. **EC2 Instances (Traditional VMs)**

**Pros:**
- Full control over OS and runtime
- Predictable performance (no cold starts)
- Long-running processes supported

**Cons:**
- Manual scaling configuration
- Server management overhead
- Fixed costs (over-provisioning required)
- Slower deployment (AMI builds)

**Rejected because:** High operational overhead, fixed costs, manual scaling.

---

### 2. **Amazon ECS/Fargate (Containers)**

**Pros:**
- Containerized applications (Docker)
- No server management (Fargate)
- Supports long-running services

**Cons:**
- More complex than Lambda
- Higher cost than serverless
- Slower cold starts than Lambda
- Requires container orchestration

**Rejected because:** Increased complexity, higher costs, slower deployment compared to Lambda.

---

### 3. **Kubernetes (EKS)**

**Pros:**
- Industry-standard container orchestration
- Portable across clouds
- Rich ecosystem

**Cons:**
- Extremely complex (cluster management, networking, etc.)
- High operational overhead
- Expensive (EKS control plane cost + worker nodes)
- Overkill for our use case

**Rejected because:** Unnecessary complexity, high costs, steep learning curve.

---

### 4. **Monolithic Application (Single Server)**

**Pros:**
- Simple deployment (one app)
- Easy to develop locally
- No distributed system complexity

**Cons:**
- Difficult to scale individual components
- Single point of failure
- Slow deployments (entire app)
- Hard to parallelize development across teams

**Rejected because:** Poor scalability, lack of fault isolation, slow deployments.

---

## Design Principles

1. **Microservices Pattern**: Each Lambda represents a bounded context (DDD)
2. **Single Responsibility**: One Lambda per domain API
3. **Stateless Execution**: State in PostgreSQL, not Lambda
4. **Event-Driven**: Async operations via RabbitMQ
5. **Infrastructure as Code**: AWS CDK for reproducibility

---

## Migration Path (if needed in future)

If we need to migrate away from Lambda:

1. **Containerization**: Package Lambda code into Docker containers
2. **Run on ECS/Fargate**: Deploy containers to ECS
3. **API Gateway → ALB**: Replace API Gateway with Application Load Balancer
4. **Business Logic Portable**: @kace/core package is Lambda-agnostic

**Estimated effort:** 4-6 weeks for full migration

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| **Cold Start P95** | < 2 seconds | 1.5 seconds |
| **Warm Invocation P95** | < 200ms | 150ms |
| **Deployment Time** | < 5 minutes per Lambda | 3 minutes |
| **Cost per 1M Requests** | < $5 | $3.50 |
| **Availability** | 99.9% | 99.95% |

---

## Related ADRs

- [ADR-002: Hexagonal Architecture and DDD](002-hexagonal-architecture-ddd.md)
- [ADR-003: Multi-Tenancy with PostgreSQL Schemas](003-multi-tenancy-postgresql-schemas.md)
- [ADR-004: Monorepo with pnpm Workspaces](004-monorepo-pnpm-workspaces.md)

---

## References

- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [Serverless Framework](https://www.serverless.com/)
- [AWS Well-Architected Framework - Serverless](https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/welcome.html)

---

**Revision History:**
- 2026-01-06: Documented in ADR format
