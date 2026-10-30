import { StackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as events from 'aws-cdk-lib/aws-events';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { OrchestratorHelper } from '@kace/aws-infra/src/helpers/OrchestratorHelper';
import { configureWorkspacePriorityOutboxRecovery } from '../src/ws-rest/configureWorkspacePriorityOutboxRecovery.mjs';

interface BcProfile {
    readonly timeout: number; // seconds
    readonly memory: number; // MB
    readonly batchSize: number; // SQS event source batch size
    readonly maxConc: number; // ESM maxConcurrency
    readonly backlogAlarms?: boolean; // enables backlog + age alarms for slow-path BCs
    readonly extraNodeModules?: string[]; // extra runtime deps to npm-install into this BC's lambda bundle
}

interface BcInfra {
    readonly queue: sqs.Queue;
    readonly dlq: sqs.Queue;
    readonly lambdaFn: NodejsFunction;
    readonly idPrefix: string;
    readonly bcKebab: string;
}

export class EventProcessorStack extends KApiStack {
    static readonly ENDPOINT = 'event-processor';
    static readonly SQS_VISIBILITY_MULT = 6;
    static readonly SQS_MAX_RECEIVE = 3;
    static readonly SQS_DLQ_RETENTION_DAYS = 14;

    static readonly CASES: BcProfile = {
        timeout: 60,
        memory: 1024,
        batchSize: 10,
        maxConc: 100,
    };
    static readonly ACTION_JOBS: BcProfile = {
        timeout: 300,
        memory: 1024,
        batchSize: 10,
        maxConc: 100,
    };
    static readonly AUTOMATED_ACTIONS: BcProfile = {
        timeout: 120,
        memory: 1024,
        batchSize: 10,
        maxConc: 100,
    };
    static readonly WS_REST: BcProfile = {
        timeout: 600,
        memory: 1024,
        batchSize: 1,
        maxConc: 200,
        backlogAlarms: true,
    };
    static readonly CASE_POST_PROCESSING: BcProfile = {
        timeout: 30,
        memory: 512,
        batchSize: 10,
        maxConc: 50,
    };
    static readonly REPORTS: BcProfile = {
        timeout: 600,
        memory: 1024,
        batchSize: 1,
        maxConc: 50,
        // Needed by the streaming export pipeline: pg-query-stream backs knex's Postgres
        // cursor streaming, @aws-sdk/lib-storage does the multipart S3 upload. Neither
        // ships in the Lambda-managed AWS SDK, so they must be real npm-installed deps.
        extraNodeModules: ['pg-query-stream', '@aws-sdk/lib-storage'],
    };
    static readonly IMPORTS: BcProfile = {
        timeout: 720,
        memory: 1024,
        batchSize: 1,
        maxConc: 50,
    };

    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const eventBus = new events.EventBus(this, 'KaceEventBus', {
            eventBusName: `${this.config.appsServiceName}-event-bus`,
        });

        new events.Archive(this, 'KaceEventsArchive', {
            sourceEventBus: eventBus,
            archiveName: `${this.config.appsServiceName}-events-archive`,
            description: 'Archive of all domain events for replay and audit',
            retention: Duration.days(90),
            eventPattern: { source: ['kace.core'] },
        });

        const cases = this.buildBcInfra('Cases', 'cases', EventProcessorStack.CASES);
        // Feature-flag de condiciones congeladas (default OFF). Se activa por entorno al desplegar.
        cases.lambdaFn.addEnvironment(
            'ACTION_FROZEN_CONDITION_CONTEXT_ENABLED',
            process.env.ACTION_FROZEN_CONDITION_CONTEXT_ENABLED ?? 'false'
        );
        const actionJobs = this.buildBcInfra('ActionJobs', 'action-jobs', EventProcessorStack.ACTION_JOBS);
        const automatedActions = this.buildBcInfra(
            'AutomatedActions',
            'automated-actions',
            EventProcessorStack.AUTOMATED_ACTIONS
        );
        const wsRest = this.buildBcInfra('WSRest', 'ws-rest', EventProcessorStack.WS_REST);
        configureWorkspacePriorityOutboxRecovery({
            scope: this,
            endpoint: EventProcessorStack.ENDPOINT,
            appsServiceName: this.config.appsServiceName,
            wsRestQueue: wsRest.queue,
            eventBus,
            getNodejsFunction: this.getNodejsFunction.bind(this),
            grantDynamoDbPermissions: this.grantDynamoDbPermissions.bind(this),
            createOrchestrator: OrchestratorHelper.createOrchestrator,
            Rule: events.Rule,
            scheduleExpression: events.Schedule.expression,
            LambdaTarget: LambdaFunction,
            durationSeconds: Duration.seconds,
        });
        const casePostProcessing = this.buildBcInfra(
            'CasePostProcessing',
            'case-post-processing',
            EventProcessorStack.CASE_POST_PROCESSING
        );
        const reports = this.buildBcInfra('Reports', 'reports', EventProcessorStack.REPORTS);
        const imports = this.buildBcInfra('Imports', 'imports', EventProcessorStack.IMPORTS);

        eventBus.grantPutEventsTo(cases.lambdaFn);
        eventBus.grantPutEventsTo(actionJobs.lambdaFn);
        eventBus.grantPutEventsTo(automatedActions.lambdaFn);
        eventBus.grantPutEventsTo(wsRest.lambdaFn);
        eventBus.grantPutEventsTo(casePostProcessing.lambdaFn);
        eventBus.grantPutEventsTo(reports.lambdaFn);

        this.grantEventPublishingPermissions(cases.lambdaFn);
        this.grantEventPublishingPermissions(actionJobs.lambdaFn);
        this.grantEventPublishingPermissions(automatedActions.lambdaFn);
        this.grantEventPublishingPermissions(wsRest.lambdaFn);

        new cloudwatch.Alarm(this, 'EventBridgeArchiveFailedInvocations', {
            metric: new cloudwatch.Metric({
                namespace: 'AWS/Events',
                metricName: 'FailedInvocations',
                dimensionsMap: { EventBusName: eventBus.eventBusName },
                period: Duration.minutes(5),
                statistic: 'Sum',
            }),
            threshold: 1,
            evaluationPeriods: 1,
            alarmDescription: 'EventBridge archive sidecar failed invocations — replay degraded',
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        });

        this.exportBcOutputs(cases);
        this.exportBcOutputs(actionJobs);
        this.exportBcOutputs(automatedActions);
        this.exportBcOutputs(wsRest);
        this.exportBcOutputs(casePostProcessing);
        this.exportBcOutputs(reports);
        this.exportBcOutputs(imports);

        this.buildDashboard(
            [cases, actionJobs, automatedActions, wsRest, casePostProcessing, reports, imports],
            eventBus
        );

        new CfnOutput(this, 'EventBusName', {
            value: eventBus.eventBusName,
            exportName: `${this.config.appsServiceName}-EventBusName`,
            description: 'EventBridge bus name (archive sidecar only)',
        });
        new CfnOutput(this, 'EventBusArn', {
            value: eventBus.eventBusArn,
            exportName: `${this.config.appsServiceName}-EventBusArn`,
            description: 'EventBridge bus ARN for IAM policies',
        });
    }

    private buildBcInfra(idPrefix: string, bcKebab: string, profile: BcProfile): BcInfra {
        const dlq = new sqs.Queue(this, `${idPrefix}EventsDLQ`, {
            queueName: `${this.config.appsServiceName}-${bcKebab}-events-dlq.fifo`,
            fifo: true,
            contentBasedDeduplication: true,
            retentionPeriod: Duration.days(EventProcessorStack.SQS_DLQ_RETENTION_DAYS),
        });

        const queue = new sqs.Queue(this, `${idPrefix}EventsQueue`, {
            queueName: `${this.config.appsServiceName}-${bcKebab}-events-queue.fifo`,
            fifo: true,
            contentBasedDeduplication: false,
            visibilityTimeout: Duration.seconds(profile.timeout * EventProcessorStack.SQS_VISIBILITY_MULT),
            receiveMessageWaitTime: Duration.seconds(20),
            deadLetterQueue: { queue: dlq, maxReceiveCount: EventProcessorStack.SQS_MAX_RECEIVE },
        });

        const bundlingOverride = profile.extraNodeModules?.length
            ? {
                  bundling: {
                      nodeModules: [...KApiStack.DEFAULT_BUNDLED_NODE_MODULES, ...profile.extraNodeModules],
                      forceDockerBundling: true,
                  },
              }
            : {};

        const lambdaFn = this.getNodejsFunction(`${EventProcessorStack.ENDPOINT}-${bcKebab}`, {
            entry: `src/${bcKebab}/handler.mjs`,
            timeout: Duration.seconds(profile.timeout),
            memorySize: profile.memory,
            ...bundlingOverride,
        });
        this.grantDynamoDbPermissions(EventProcessorStack.ENDPOINT, lambdaFn);

        queue.grantConsumeMessages(lambdaFn);
        lambdaFn.addEventSource(
            new lambdaEventSources.SqsEventSource(queue, {
                batchSize: profile.batchSize,
                maxConcurrency: profile.maxConc,
                reportBatchItemFailures: true,
            })
        );

        this.buildBcAlarms(idPrefix, queue, dlq, lambdaFn, profile);

        if (profile.backlogAlarms) {
            new cloudwatch.Alarm(this, `${idPrefix}EventsBacklogAlarm`, {
                metric: queue.metricApproximateNumberOfMessagesVisible({ period: Duration.minutes(5) }),
                threshold: 1000,
                evaluationPeriods: 3,
                alarmDescription: 'WS-REST queue backlog > 1000 for 15 min — slow path saturated',
                comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            });

            new cloudwatch.Alarm(this, `${idPrefix}EventsAgeAlarm`, {
                metric: new cloudwatch.Metric({
                    namespace: 'AWS/SQS',
                    metricName: 'ApproximateAgeOfOldestMessage',
                    dimensionsMap: { QueueName: queue.queueName },
                    period: Duration.minutes(5),
                    statistic: 'Maximum',
                }),
                threshold: 300,
                evaluationPeriods: 1,
                alarmDescription: 'WS-REST oldest message > 5 min — processing stuck',
                comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            });
        }

        return { queue, dlq, lambdaFn, idPrefix, bcKebab };
    }

    private buildBcAlarms(
        idPrefix: string,
        queue: sqs.Queue,
        dlq: sqs.Queue,
        lambdaFn: NodejsFunction,
        profile: BcProfile
    ) {
        new cloudwatch.Alarm(this, `${idPrefix}EventsDLQAlarm`, {
            metric: dlq.metricApproximateNumberOfMessagesVisible({ period: Duration.minutes(5) }),
            threshold: 5,
            evaluationPeriods: 1,
            alarmDescription: `${idPrefix} events failed after ${EventProcessorStack.SQS_MAX_RECEIVE} retries — DLQ filling`,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        });

        new cloudwatch.Alarm(this, `${idPrefix}LambdaErrorsAlarm`, {
            metric: lambdaFn.metricErrors({ period: Duration.minutes(5) }),
            threshold: 1,
            evaluationPeriods: 1,
            alarmDescription: `${idPrefix} Lambda errors detected`,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        });

        new cloudwatch.Alarm(this, `${idPrefix}LambdaThrottlesAlarm`, {
            metric: lambdaFn.metricThrottles({ period: Duration.minutes(5) }),
            threshold: 10,
            evaluationPeriods: 1,
            alarmDescription: `${idPrefix} Lambda throttles >10 in 5min — account concurrency pool exhausted`,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        });

        new cloudwatch.Alarm(this, `${idPrefix}LambdaDurationP99Alarm`, {
            metric: lambdaFn.metricDuration({ period: Duration.minutes(5), statistic: 'p99' }),
            threshold: profile.timeout * 1000 * 0.8,
            evaluationPeriods: 1,
            alarmDescription: `${idPrefix} Lambda p99 > 80% timeout — latency degraded`,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        });
    }

    private exportBcOutputs(bc: BcInfra) {
        new CfnOutput(this, `${bc.idPrefix}EventsQueueUrl`, {
            value: bc.queue.queueUrl,
            exportName: `${this.config.appsServiceName}-${bc.idPrefix}EventsQueueUrl`,
            description: `SQS FIFO Queue URL for ${bc.bcKebab} events`,
        });
        new CfnOutput(this, `${bc.idPrefix}EventsQueueArn`, {
            value: bc.queue.queueArn,
            exportName: `${this.config.appsServiceName}-${bc.idPrefix}EventsQueueArn`,
            description: `SQS FIFO Queue ARN for ${bc.bcKebab} events`,
        });
        new CfnOutput(this, `${bc.idPrefix}EventsDLQUrl`, {
            value: bc.dlq.queueUrl,
            exportName: `${this.config.appsServiceName}-${bc.idPrefix}EventsDLQUrl`,
            description: `DLQ URL for ${bc.bcKebab} events`,
        });
    }

    private buildDashboard(bcs: BcInfra[], eventBus: events.EventBus) {
        const dashboard = new cloudwatch.Dashboard(this, 'KaceEventProcessorDashboard', {
            dashboardName: `${this.config.appsServiceName}-event-processor`,
        });

        dashboard.addWidgets(
            new cloudwatch.GraphWidget({
                title: 'Invocations por BC',
                left: bcs.map((bc) => bc.lambdaFn.metricInvocations({ period: Duration.minutes(5) })),
                width: 12,
            }),
            new cloudwatch.GraphWidget({
                title: 'Queue depth por BC',
                left: bcs.map((bc) =>
                    bc.queue.metricApproximateNumberOfMessagesVisible({ period: Duration.minutes(5) })
                ),
                width: 12,
            })
        );

        dashboard.addWidgets(
            ...bcs.map(
                (bc) =>
                    new cloudwatch.GraphWidget({
                        title: `Duration ${bc.bcKebab}`,
                        left: [
                            bc.lambdaFn.metricDuration({ period: Duration.minutes(5), statistic: 'p50' }),
                            bc.lambdaFn.metricDuration({ period: Duration.minutes(5), statistic: 'p95' }),
                            bc.lambdaFn.metricDuration({ period: Duration.minutes(5), statistic: 'p99' }),
                        ],
                        width: 6,
                    })
            )
        );

        dashboard.addWidgets(
            new cloudwatch.GraphWidget({
                title: 'Errors (izq) + Throttles (der) por BC',
                left: bcs.map((bc) => bc.lambdaFn.metricErrors({ period: Duration.minutes(5) })),
                right: bcs.map((bc) => bc.lambdaFn.metricThrottles({ period: Duration.minutes(5) })),
                width: 12,
            }),
            new cloudwatch.GraphWidget({
                title: 'DLQ depth por BC',
                left: bcs.map((bc) => bc.dlq.metricApproximateNumberOfMessagesVisible({ period: Duration.minutes(5) })),
                width: 12,
            })
        );

        dashboard.addWidgets(
            new cloudwatch.GraphWidget({
                title: 'RoutingEventBus.PublishLatency p99 (productores)',
                left: [
                    new cloudwatch.MathExpression({
                        expression:
                            'SEARCH(\'{KACECloud/MultiTenant,TenantId,Target} MetricName="RoutingEventBus.PublishLatency" Target="sqs"\', \'p99\', 300)',
                        label: 'PublishLatency p99 (sqs, by tenant)',
                        usingMetrics: {},
                        period: Duration.minutes(5),
                    }),
                ],
                width: 12,
            }),
            new cloudwatch.GraphWidget({
                title: 'EventBridge Archive FailedInvocations',
                left: [
                    new cloudwatch.Metric({
                        namespace: 'AWS/Events',
                        metricName: 'FailedInvocations',
                        dimensionsMap: { EventBusName: eventBus.eventBusName },
                        period: Duration.minutes(5),
                        statistic: 'Sum',
                    }),
                ],
                width: 12,
            })
        );
    }
}
