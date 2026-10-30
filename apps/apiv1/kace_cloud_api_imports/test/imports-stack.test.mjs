import { describe, expect, it, jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

describe('ImportsStack - Event Publishing Permissions', () => {
    it('synthesizes stack and verifies IAM policy includes sqs:SendMessage for imports events queue', async () => {
        jest.mock('aws-cdk-lib/aws-lambda-nodejs', () => {
            const { Function, InlineCode, Runtime } = require('aws-cdk-lib/aws-lambda');
            return {
                NodejsFunction: class MockNodejsFunction extends Function {
                    constructor(scope, id, _props) {
                        super(scope, id, {
                            runtime: Runtime.NODEJS_22_X,
                            handler: 'index.handler',
                            code: new InlineCode('exports.handler = async () => {};'),
                        });
                    }
                },
            };
        });

        const { App } = await import('aws-cdk-lib');
        const { Template, Match } = await import('aws-cdk-lib/assertions');
        const { KApiStack } = await import('@kace/aws-infra/src/KApiStack.js');

        // Dynamically load ImportsStack by transpiling imports-stack.ts
        const tsSource = readFileSync(new URL('../lib/imports-stack.ts', import.meta.url), 'utf8');
        const ts = (await import('typescript')).default;
        const jsOutput = ts.transpileModule(tsSource, {
            compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
        }).outputText;
        const base64Uri = `data:text/javascript;base64,${Buffer.from(jsOutput).toString('base64')}`;
        const { ImportsStack } = await import(base64Uri);

        const importsQueueArn = 'arn:aws:sqs:us-east-1:123456789012:kace-test-imports-events-queue.fifo';
        const app = new App();
        const props = {
            env: {
                account: '123456789012',
                region: 'us-east-1',
            },
        };

        const kProps = {
            ...KApiStack.KProps(),
            appsServiceName: 'kace-test',
            pathHandler: '/fake/path/handler.mjs',
            awsCasesEventsQueueArn: undefined,
            awsActionJobsEventsQueueArn: undefined,
            awsAutomatedActionsEventsQueueArn: undefined,
            awsWsRestEventsQueueArn: undefined,
            awsCasePostProcessingEventsQueueArn: undefined,
            awsReportsEventsQueueArn: undefined,
            awsImportsEventsQueueArn: importsQueueArn,
        };

        const stack = new ImportsStack(app, 'TestImportsStack', props, kProps);
        const template = Template.fromStack(stack);

        template.hasResourceProperties('AWS::IAM::Policy', {
            PolicyDocument: {
                Statement: Match.arrayWith([
                    Match.objectLike({
                        Action: 'sqs:SendMessage',
                        Effect: 'Allow',
                        Resource: Match.anyValue(),
                    }),
                ]),
            },
        });

        const policies = template.findResources('AWS::IAM::Policy');
        const statements = Object.values(policies).flatMap(
            (policy) => policy.Properties?.PolicyDocument?.Statement || []
        );
        const sqsStatement = statements.find((stmt) => stmt.Action === 'sqs:SendMessage' && stmt.Effect === 'Allow');
        expect(sqsStatement).toBeDefined();
        const resources = Array.isArray(sqsStatement.Resource) ? sqsStatement.Resource : [sqsStatement.Resource];
        expect(resources).toContain(importsQueueArn);
    });
});
