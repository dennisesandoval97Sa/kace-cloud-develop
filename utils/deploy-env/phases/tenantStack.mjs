import { createStackPhase } from './stackPhase.mjs';

export const tenantStack = createStackPhase({
    name: 'tenant-stack',
    stackId: 'TenantStack',
    command: ['pnpm', '--filter', '@kace/api-tenant', 'run', 'cdk:deploy'],
});
