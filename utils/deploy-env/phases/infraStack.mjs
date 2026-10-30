import { createStackPhase } from './stackPhase.mjs';

// alwaysDeploy: @kace/aws-infra no tiene script cdk:deploy, así que services nunca lo
// actualiza. Si se saltara por existir, un cambio de plantilla no se aplicaría jamás.
export const infraStack = createStackPhase({
    name: 'infra-stack',
    stackId: 'AwsInfraStack',
    command: ['pnpm', '--filter', '@kace/aws-infra', 'exec', 'cdk', 'deploy', '--require-approval', 'never'],
    alwaysDeploy: true,
});
