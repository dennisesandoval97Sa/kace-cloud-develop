# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` jest (los E2E se omiten salvo `CASES_BULK_E2E=true`)
- `pnpm run test:e2e` ejecuta E2E de `POST /transition`
- `npx cdk deploy` deploy this stack to your default AWS account/region
- `npx cdk diff` compare deployed stack with current state
- `npx cdk synth` emits the synthesized CloudFormation template

## E2E

1. Mismas variables que otras APIs (`TEST_TENANT_ID`, auth para `TestHelper`, huellas).
2. Postgres coherente con `production` en `@kace/database/knexfile`.
3. Terminal 1: `pnpm run api` (puerto `60096`).
4. Terminal 2: `pnpm run test:e2e`.

Con `APPS_ENVIRONMENT=staging` la base URL usa `https://{APPS_API_SUBDOMAIN}.{APPS_DOMAIN}/cases-bulk`.
