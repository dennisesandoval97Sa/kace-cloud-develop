import { jest } from '@jest/globals';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

process.env.AWS_DYNAMODB_MULTITENANT_TABLE_ARN = 'arn:aws:dynamodb:us-east-1:123456789012:table/services';

jest.mock('../src/ws-rest/configureWorkspacePriorityOutboxRecovery.mjs', () => ({
    configureWorkspacePriorityOutboxRecovery: jest.fn(),
}));

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

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

const { App } = await import('aws-cdk-lib');
const { Template, Match } = await import('aws-cdk-lib/assertions');

let generatedJs = false;
const stackJsUrl = new URL('../lib/event-processor-stack.js', import.meta.url);
if (!existsSync(stackJsUrl)) {
    generatedJs = true;
    const tsSource = readFileSync(new URL('../lib/event-processor-stack.ts', import.meta.url), 'utf8');
    const ts = (await import('typescript')).default;
    const jsOutput = ts.transpileModule(tsSource, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    writeFileSync(stackJsUrl, jsOutput, 'utf8');
}
const { EventProcessorStack } = await import('../lib/event-processor-stack.js');
const { KApiStack } = await import('@kace/aws-infra/src/KApiStack.js');
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('EventProcessorStack - Imports BC Infra', () => {
    let template;

    afterAll(() => {
        if (generatedJs && existsSync(stackJsUrl)) {
            unlinkSync(stackJsUrl);
        }
    });

    beforeAll(() => {
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
            pathHandler: path.join(__dirname, '../src/cases/handler.mjs'),
        };

        const stack = new EventProcessorStack(app, 'TestEventProcessorStack', props, kProps);
        template = Template.fromStack(stack);
    });

    it('provisions SQS FIFO queue for imports events with 720s * 6 visibility timeout', () => {
        template.hasResourceProperties('AWS::SQS::Queue', {
            QueueName: Match.stringLikeRegexp('imports-events-queue\\.fifo$'),
            FifoQueue: true,
            ContentBasedDeduplication: false,
            VisibilityTimeout: 720 * 6, // 4320s
        });
    });

    it('provisions SQS FIFO DLQ for imports events', () => {
        template.hasResourceProperties('AWS::SQS::Queue', {
            QueueName: Match.stringLikeRegexp('imports-events-dlq\\.fifo$'),
            FifoQueue: true,
            ContentBasedDeduplication: true,
        });
    });

    it('provisions CloudWatch DLQ alarm for imports events', () => {
        template.hasResourceProperties('AWS::CloudWatch::Alarm', {
            AlarmDescription: Match.stringLikeRegexp('Imports events failed after'),
            ComparisonOperator: 'GreaterThanOrEqualToThreshold',
            Threshold: 5,
        });
    });

    it('provisions CloudWatch Lambda errors alarm for imports events', () => {
        template.hasResourceProperties('AWS::CloudWatch::Alarm', {
            AlarmDescription: Match.stringLikeRegexp('Imports Lambda errors detected'),
            ComparisonOperator: 'GreaterThanOrEqualToThreshold',
            Threshold: 1,
        });
    });

    it('exports ImportsEventsQueueUrl, QueueArn and DLQUrl CfnOutputs', () => {
        template.hasOutput('ImportsEventsQueueUrl', {});
        template.hasOutput('ImportsEventsQueueArn', {});
        template.hasOutput('ImportsEventsDLQUrl', {});
    });
});
