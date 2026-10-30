# ADR-002: Hexagonal Architecture and Domain-Driven Design

**Status:** ✅ Accepted


**Decision Makers:** Corporate Architecture Team, Lead Engineers

---

## Context

KACE Cloud's business logic is complex, involving:
- **81 bounded contexts** (cases, clients, users, workflows, classifications, etc.)
- **Complex domain rules** (SLA calculations, state transitions, workflow automation)
- **Multi-tenant operations** with tenant-specific configurations
- **Long-term maintainability** (5-10 year product lifecycle)
- **Team collaboration** (10+ developers working concurrently)

Traditional layered architectures (Controller → Service → DAO) suffer from:
- **Tight coupling** between layers (business logic leaks into controllers)
- **Difficult testing** (hard to mock infrastructure dependencies)
- **Technology lock-in** (business logic tied to framework/database)
- **Poor domain modeling** (anemic domain models, procedural code)
- **Hard to reason about** (no clear boundaries between concerns)

---

## Decision

We will adopt **Hexagonal Architecture (Ports & Adapters)** combined with **Domain-Driven Design (DDD)** principles for the @kace/core business logic package.

### Architecture Layers

```
┌─────────────────────────────────────────────────┐
│  Lambda Handler (Port - HTTP Interface)         │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  Controller (Adapter - Request Routing)         │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  Application Layer (Use Cases)                  │
│  - CaseCreator, CaseFinder, CaseUpdater, etc.   │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  Domain Layer (Business Logic)                  │
│  - Entities (Aggregate Roots)                   │
│  - Value Objects                                │
│  - Domain Services                              │
│  - Domain Events (future)                       │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  Infrastructure Layer (Adapters)                │
│  - Repositories (Knex.js)                       │
│  - External Services (S3, RabbitMQ, Cognito)    │
└─────────────────────────────────────────────────┘
```

### Key Patterns

1. **Bounded Contexts**: 81 modules in @kace/core (cases, clients, users, etc.)
2. **Aggregate Roots**: Case, Client, User, Classification, etc.
3. **Value Objects**: Immutable data structures (CaseId, CaseDate, CaseAns)
4. **Use Case Pattern**: Separate classes for operations (Creator, Finder, Updater, Deleter, Searcher)
5. **Repository Pattern**: Abstract data access (KnexCaseRepository implements CaseRepository port)
6. **Dependency Injection**: Controllers inject repositories into use cases

---

## Consequences

### ✅ Positive

1. **Technology Independence**
   - Business logic in @kace/core is database-agnostic
   - Can swap Knex.js for Prisma, TypeORM, or raw SQL without changing use cases
   - Domain layer has no dependencies on AWS, HTTP, or frameworks

2. **Testability**
   - Domain logic tested in isolation (no database, HTTP, or AWS mocks)
   - Use cases tested with in-memory repositories
   - 80%+ code coverage achieved easily

3. **Clear Separation of Concerns**
   - Domain layer: Pure business rules
   - Application layer: Orchestration and DTOs
   - Infrastructure layer: Technical implementations
   - Each layer has distinct responsibilities

4. **Maintainability**
   - Business rules centralized in domain entities
   - Easy to locate and modify logic (everything in one place)
   - Refactoring safe (changes isolated to layers)

5. **Team Collaboration**
   - Domain experts can review domain layer code
   - Developers can work on different bounded contexts independently
   - Clear boundaries reduce merge conflicts

6. **Evolvability**
   - New features added as new use cases
   - Domain model evolves incrementally
   - Easy to add new adapters (e.g., GraphQL API, gRPC)

7. **Ubiquitous Language**
   - Code uses domain terminology (Case, Client, Classification)
   - Aligns with business stakeholders
   - Easier communication between developers and product team

### ❌ Negative

1. **Increased Complexity**
   - More files and folders (3 layers per bounded context)
   - Higher learning curve for new developers
   - **Mitigation**:
     - Comprehensive documentation (this ADR)
     - Onboarding sessions for new team members
     - Consistent structure across all 81 modules

2. **Boilerplate Code**
   - Each use case requires separate class (CaseCreator, CaseFinder, etc.)
   - DTOs for each entity (CaseResponse, CaseCollectionResponse)
   - **Mitigation**:
     - Code generators for new bounded contexts (future)
     - Consistent naming conventions reduce cognitive load
     - Benefits outweigh boilerplate cost

3. **Performance Overhead**
   - Extra mapping layers (entity ↔ DTO ↔ database record)
   - **Mitigation**:
     - Minimal overhead (< 1ms per request)
     - View repositories for optimized read-only queries
     - Caching at infrastructure layer (LRU-Cache)

4. **Over-Engineering for Simple CRUDs**
   - Some entities (e.g., auxiliaries, literals) are simple lookups
   - **Mitigation**:
     - Apply patterns selectively (simpler approach for trivial entities)
     - Benefits emerge for complex entities (cases, workflows, actions)

---

## Implementation Details

### Bounded Context Structure (Example: cases/)

```
packages/kace_cloud_core/src/cases/
├── domain/
│   ├── Case.js (Aggregate Root)
│   ├── CaseAns.js (Value Object)
│   ├── SubcasesRelationship.js (Value Object)
│   ├── CaseFinder.js (Domain Service)
│   └── CaseCounter.js (Domain Service)
├── application/
│   ├── create/CaseCreator.js
│   ├── update/CaseUpdater.js
│   ├── delete/CaseDeleter.js
│   ├── find/CaseFinder.js
│   ├── search/CaseSearcher.js
│   ├── CaseResponse.js (DTO)
│   └── CaseCollectionResponse.js (DTO)
├── infrastructure/
│   ├── persistence/KnexCaseRepository.js
│   ├── persistence/KnexViewCaseRepository.js (read-only)
│   └── external/S3ScanService.js
└── index.js (Public API exports)
```

### Use Case Pattern Example

```javascript
// Application Layer: Use Case
class CaseCreator {
    constructor(repository, ansRepository) {
        this.repository = repository;
        this.ansRepository = ansRepository;
    }

    async execute(dto) {
        // 1. Create aggregate root (domain logic)
        const newCase = Case.create({
            title: dto.titulo,
            description: dto.descripcion,
            clientId: dto.idCliente,
            classificationId: dto.idClasificacion,
            priority: dto.prioridad || 3,
            status: 'OPEN'
        });

        // 2. Apply business rules
        newCase.markCreatedAt(new Date());
        newCase.assignCreator(dto.createdBy);

        // 3. Validate domain invariants
        if (!newCase.hasValidPriority()) {
            throw new DomainException('Invalid priority');
        }

        // 4. Persist via repository (abstracted)
        await this.repository.create(newCase);

        // 5. Create related ANS (SLA)
        const ans = CaseAns.create({ caseId: newCase.id });
        await this.ansRepository.create(ans);

        // 6. Return DTO
        return CaseResponse.fromEntity(newCase);
    }
}
```

### Repository Pattern Example

```javascript
// Domain Layer: Port (Interface)
class CaseRepository {
    async create(case) { throw new Error('Not implemented'); }
    async findById(id) { throw new Error('Not implemented'); }
    async update(case) { throw new Error('Not implemented'); }
    async delete(id) { throw new Error('Not implemented'); }
}

// Infrastructure Layer: Adapter (Implementation)
class KnexCaseRepository extends CaseRepository {
    constructor(knexConfig) {
        super();
        this.connection = knex(knexConfig);
    }

    async create(case) {
        await this.connection('casos').insert({
            id: case.id,
            titulo: case.title,
            descripcion: case.description,
            id_cliente: case.clientId,
            estado: case.status,
            prioridad: case.priority
        });
    }

    async findById(id) {
        const record = await this.connection('casos')
            .where('id', id)
            .first();
        return Case.reconstruct(record); // Convert DB record to domain entity
    }
}
```

---

## Alternatives Considered

### 1. **Traditional Layered Architecture (MVC)**

**Structure:**
```
Controller → Service → DAO → Database
```

**Pros:**
- Simple to understand
- Less boilerplate
- Faster initial development

**Cons:**
- Business logic leaks into services/controllers
- Tight coupling to database
- Difficult to test in isolation
- Anemic domain models

**Rejected because:** Poor separation of concerns, tight coupling, hard to test.

---

### 2. **Transaction Script Pattern**

**Structure:**
```
Controller → Script (procedural functions) → Database
```

**Pros:**
- Very simple
- Minimal abstraction
- Fast for simple CRUDs

**Cons:**
- No domain modeling
- Logic duplication across scripts
- Hard to maintain as complexity grows
- No encapsulation

**Rejected because:** Does not scale for complex domain (81 bounded contexts).

---

### 3. **CQRS + Event Sourcing (Full DDD)**

**Structure:**
```
Commands → Aggregates → Event Store → Projections → Queries
```

**Pros:**
- Perfect audit trail (event sourcing)
- Time-travel debugging
- Scalable reads/writes independently

**Cons:**
- Extremely complex (steep learning curve)
- Event store infrastructure required
- Eventual consistency challenges
- Overkill for current requirements

**Rejected because:** Unnecessary complexity for our use case. May revisit in future.

---

## Design Principles

1. **Dependency Rule**: Inner layers (domain) do not depend on outer layers (infrastructure)
2. **Ubiquitous Language**: Code uses business terminology
3. **Aggregate Boundaries**: One aggregate root per bounded context
4. **Use Case Isolation**: Each operation is a separate class
5. **Repository Abstraction**: Data access abstracted behind interfaces

---

## Migration Strategy

Existing code (if any) migrated to hexagonal architecture:
1. Extract business logic from controllers into domain entities
2. Create use cases for CRUD operations
3. Implement repositories for data access
4. Update controllers to use use cases

**Estimated effort per bounded context:** 2-3 days

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| **Code Coverage (Domain)** | > 90% | 85% |
| **Code Coverage (Application)** | > 80% | 80% |
| **Code Coverage (Infrastructure)** | > 70% | 75% |
| **Cyclomatic Complexity (avg)** | < 10 | 8 |
| **Domain Layer Dependencies** | 0 (no external deps) | 0 |

---

## Related ADRs

- [ADR-001: Serverless Architecture with AWS Lambda](001-serverless-architecture-aws-lambda.md)

---

## References

- [Hexagonal Architecture (Alistair Cockburn)](https://alistair.cockburn.us/hexagonal-architecture/)
- [Domain-Driven Design (Eric Evans)](https://www.domainlanguage.com/ddd/)
- [Clean Architecture (Robert C. Martin)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

---

**Revision History:**
- 2026-01-06: Documented in ADR format
