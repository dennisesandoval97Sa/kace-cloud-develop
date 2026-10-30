# KACE Cloud API Tenant

Lambda microservice for managing Tenant resources using DynamoDB.

## Documentation

**API Documentation:** Complete OpenAPI/Swagger documentation is available in the [`docs/`](./docs) folder.

- [OpenAPI Specification](./swagger.yaml) - Full API specification in OpenAPI 3.0 format
- [API Examples](./docs/API_EXAMPLES.md) - Practical examples with curl, JavaScript, and Node.js
- [Documentation Guide](./docs/README.md) - How to view and use the API documentation

To view the interactive API documentation, see the [Documentation Guide](./docs/README.md) for multiple viewing options including Swagger UI, Redoc, and VSCode extensions.

## Commands

```bash
# Install dependencies
pnpm install

# Run tests
pnpm run test

# Start local API
pnpm run api

# Deploy to AWS
pnpm run cdk:deploy

# Synthesize CloudFormation
pnpm run cdk:synth
```

## API Endpoints

⚠️ **IMPORTANT:** This API uses `subdomain` as the primary key. Path parameters use subdomain values (e.g., "acme"), NOT UUIDs.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tenant` | List all tenants (paginated) |
| POST | `/tenant` | Create a new tenant |
| GET | `/tenant/{subdomain}` | Find tenant by subdomain (primary key) |
| POST | `/tenant/{subdomain}` | Update an existing tenant |
| GET | `/tenant/{subdomain}/delete` | Delete a tenant (soft delete) |

**Examples:**
- ✅ `GET /tenant/acme` - Find tenant with subdomain "acme"
- ✅ `POST /tenant/acme` - Update tenant with subdomain "acme"
- ❌ `GET /tenant/550e8400-...` - UUID paths will NOT work

For detailed endpoint documentation including request/response schemas, see the [OpenAPI Specification](./swagger.yaml).

## Architecture

This microservice uses:
- AWS Lambda for serverless compute
- DynamoDB for data persistence
- API Gateway for HTTP routing
- AWS CDK for infrastructure as code
