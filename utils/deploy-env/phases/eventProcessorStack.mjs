import { createStackPhase } from './stackPhase.mjs';

export const eventProcessorStack = createStackPhase({
    name: 'event-processor-stack',
    stackId: 'EventProcessorStack',
    command: ['pnpm', '--filter', '@kace/api-event-processor', 'run', 'cdk:deploy'],
});
