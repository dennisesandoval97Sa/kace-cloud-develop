import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { InstanceType, ISecurityGroup, IVpc, SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { AutoScalingGroup } from 'aws-cdk-lib/aws-autoscaling';
import {
    AsgCapacityProvider,
    Cluster,
    ContainerImage,
    Ec2Service,
    Ec2TaskDefinition,
    EcsOptimizedImage,
    ICluster,
    LogDriver,
    NetworkMode,
    PropagatedTagSource,
} from 'aws-cdk-lib/aws-ecs';
import { DockerImageAsset, Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import path from 'node:path'; // SONAR-EXC: Esta importación es nativa de NODE por lo que no es necesario agregarla como dependencia.

export interface ActionsQueueExecutionsWorkerStackProps extends StackProps {
    instanceType: InstanceType;
    appsServiceName: string;
    workerConcurrency?: number;
    shutdownGracePeriodSec?: number;
    lockStalenessMinutes?: number;
    healthStalenessSeconds?: number;
    ansHealthStalenessSeconds?: number;
    fastMemoryReservationMiB?: number;
    ansMemoryReservationMiB?: number;
    minHealthyPercent?: number;
    maxHealthyPercent?: number;
    healthCheckIntervalSec?: number;
    healthCheckTimeoutSec?: number;
    healthCheckRetries?: number;
    healthCheckStartPeriodSec?: number;
    cluster?: ICluster;
    vpcId?: string;
    vpcAvailabilityZones?: string[];
    vpcPrivateSubnetIds?: string[];
    vpcPrivateSubnetRouteTableIds?: string[];
    securityGroupId?: string;
    multiTenancyTableName: string;
    awsRegion: string;
    debugOverrideParameterName?: string;
    awsEventBridgeEventBusArn: string;
    awsCasesEventsQueueArn?: string;
    awsActionJobsEventsQueueArn?: string;
    awsAutomatedActionsEventsQueueArn?: string;
    awsWsRestEventsQueueArn?: string;
}

export class ActionsQueueExecutionsWorkerStack extends Stack {
    constructor(scope: Construct, id: string, props: ActionsQueueExecutionsWorkerStackProps) {
        super(scope, `${props.appsServiceName}${id}`, props);

        // Fail loud at synth/deploy time. The worker publishes routing events to these FIFO
        // queues; the sqs:SendMessage grant for each is created only when its ARN is present
        // (see eventQueueArns below). A missing ARN previously deployed a worker that ran but
        // had every publish to that queue denied at runtime (sqs:SendMessage AccessDenied),
        // so the downstream never consumed and the producer never drained — a silent outage.
        // Require them all explicitly instead.
        const requiredQueueArns: Array<[string, string | undefined]> = [
            ['AWS_CASES_EVENTS_QUEUE_ARN', props.awsCasesEventsQueueArn],
            ['AWS_ACTION_JOBS_EVENTS_QUEUE_ARN', props.awsActionJobsEventsQueueArn],
            ['AWS_AUTOMATED_ACTIONS_EVENTS_QUEUE_ARN', props.awsAutomatedActionsEventsQueueArn],
            ['AWS_WS_REST_EVENTS_QUEUE_ARN', props.awsWsRestEventsQueueArn],
        ];
        const missingQueueArns = requiredQueueArns.filter(([, arn]) => !arn).map(([envVar]) => envVar);
        if (missingQueueArns.length > 0) {
            throw new Error(
                `Missing required event queue ARN(s): ${missingQueueArns.join(', ')}. ` +
                    'Set them before deploying. Without each ARN the worker cannot publish to that queue ' +
                    '(sqs:SendMessage is denied at runtime).'
            );
        }

        const concurrency = props.workerConcurrency ?? 5;
        const grace = props.shutdownGracePeriodSec ?? 300;
        const staleness = props.lockStalenessMinutes ?? 30;

        // In-place deploys (stop old, start new) instead of overlap. With TWO awsvpc services
        // sharing one m5.large, the 2 task-ENIs are fully used at steady state (fast + ans), so a
        // rolling overlap (min=100/max=200) would need a 3rd ENI that the instance does not have
        // and the deploy would wedge. min=0/max=100 frees an ENI before launching the replacement;
        // a brief gap on deploy is fine for background workers. To restore zero-downtime overlap,
        // move to a larger instance (or enable ENI trunking) and set min=100/max=200 via props.
        const minHealthyPercent = props.minHealthyPercent ?? 0;
        const maxHealthyPercent = props.maxHealthyPercent ?? 100;

        // Health check tolerant enough that a transient busy event loop (heavy job tick) does
        // not trip a replacement. ~150s of tolerance (retries x interval) vs the old ~90s,
        // and a longer startPeriod to cover boot + first heavy tick.
        const healthCheckIntervalSec = props.healthCheckIntervalSec ?? 30;
        const healthCheckTimeoutSec = props.healthCheckTimeoutSec ?? 10;
        const healthCheckRetries = props.healthCheckRetries ?? 5;
        const healthCheckStartPeriodSec = props.healthCheckStartPeriodSec ?? 120;

        const vpc: IVpc = props.vpcId
            ? Vpc.fromVpcAttributes(this, 'WorkerVpc', {
                  vpcId: props.vpcId,
                  availabilityZones: props.vpcAvailabilityZones ?? [],
                  privateSubnetIds: props.vpcPrivateSubnetIds ?? [],
                  privateSubnetRouteTableIds: props.vpcPrivateSubnetRouteTableIds ?? [],
              })
            : Vpc.fromLookup(this, 'WorkerVpc', { isDefault: false });

        const cluster: ICluster =
            props.cluster ??
            new Cluster(this, 'WorkerCluster', {
                vpc,
                clusterName: `${props.appsServiceName}-actions-queue-executions-worker`,
            });

        // Associate an externally-managed security group (env AWS_EC2_WORKER_SECURITY_GROUP_ID).
        // `mutable: false` so CDK treats it as read-only and never tries to add/remove egress rules
        // on a group it does not own. Fail loud at synth/deploy time when the id is missing: the
        // worker must attach to the pre-provisioned SG (DB/RDS-Proxy/RabbitMQ ingress is keyed to
        // it), so silently creating a fresh worker-owned SG would deploy a worker that cannot reach
        // its dependencies — a silent outage. Require it explicitly instead.
        if (!props.securityGroupId) {
            throw new Error(
                'Missing required security group id (AWS_EC2_WORKER_SECURITY_GROUP_ID). ' +
                    'Set it before deploying. Without it the worker would attach to a fresh SG with no ' +
                    'ingress to its dependencies (DB/RDS-Proxy) and fail at runtime.'
            );
        }

        const workerSg: ISecurityGroup = SecurityGroup.fromSecurityGroupId(this, 'WorkerSg', props.securityGroupId, {
            mutable: false,
        });

        const asg = new AutoScalingGroup(this, 'WorkerAsg', {
            vpc,
            instanceType: props.instanceType,
            machineImage: EcsOptimizedImage.amazonLinux2023(),
            minCapacity: 1,
            maxCapacity: 1,
            desiredCapacity: 1,
            vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
            securityGroup: workerSg,
        });

        const capacityProvider = new AsgCapacityProvider(this, 'WorkerCapacityProvider', {
            autoScalingGroup: asg,
            enableManagedTerminationProtection: false,
            enableManagedScaling: false,
        });

        if (cluster instanceof Cluster) {
            cluster.addAsgCapacityProvider(capacityProvider);
        }

        const taskRole = new Role(this, 'WorkerTaskRole', {
            assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
            description: 'Permissions for actions-queue-executions worker container',
        });

        taskRole.addToPolicy(
            new PolicyStatement({
                actions: ['dynamodb:GetItem', 'dynamodb:Query', 'dynamodb:Scan'],
                resources: [`arn:aws:dynamodb:${props.awsRegion}:${this.account}:table/${props.multiTenancyTableName}`],
            })
        );

        if (props.debugOverrideParameterName) {
            taskRole.addToPolicy(
                new PolicyStatement({
                    actions: ['ssm:GetParameter'],
                    resources: [
                        `arn:aws:ssm:${props.awsRegion}:${this.account}:parameter${props.debugOverrideParameterName}`,
                    ],
                })
            );
        }

        if (props.awsEventBridgeEventBusArn) {
            taskRole.addToPolicy(
                new PolicyStatement({
                    actions: ['events:PutEvents'],
                    resources: [props.awsEventBridgeEventBusArn],
                })
            );
        }

        const eventQueueArns = [
            props.awsCasesEventsQueueArn,
            props.awsActionJobsEventsQueueArn,
            props.awsAutomatedActionsEventsQueueArn,
            props.awsWsRestEventsQueueArn,
        ].filter((arn): arn is string => Boolean(arn));

        if (eventQueueArns.length > 0) {
            taskRole.addToPolicy(
                new PolicyStatement({
                    actions: ['sqs:SendMessage'],
                    resources: eventQueueArns,
                })
            );
        }

        // Separate log groups so the heavy ANS recalc logs don't drown the fast worker's.
        // DESTROY: the names are fixed, so a retained group left behind by a deleted or rolled-back
        // stack makes the next create fail with "already exists".
        const fastLogGroup = new LogGroup(this, 'WorkerLogGroup', {
            logGroupName: `/ecs/${props.appsServiceName}/actions-queue-executions-worker`,
            retention: RetentionDays.ONE_MONTH,
            removalPolicy: RemovalPolicy.DESTROY,
        });
        const ansLogGroup = new LogGroup(this, 'WorkerAnsLogGroup', {
            logGroupName: `/ecs/${props.appsServiceName}/actions-queue-executions-worker-ans`,
            retention: RetentionDays.ONE_MONTH,
            removalPolicy: RemovalPolicy.DESTROY,
        });

        // IMPORTANT: the build context is the monorepo root (4 levels up from this file's lib/ dir)
        // because the Dockerfile uses pnpm-workspace metadata.
        const monorepoRoot = path.resolve(__dirname, '..', '..', '..', '..');
        const image = new DockerImageAsset(this, 'WorkerImage', {
            directory: monorepoRoot,
            file: 'apps/workers/kace_cloud_worker_actions_queue_executions/Dockerfile',
            platform: Platform.LINUX_AMD64,
            exclude: ['**/cdk.out', '**/node_modules', '**/dist', '**/coverage', '.git', 'docs/superpowers'],
        });

        // Env shared by both modes; WORKER_MODE, HEALTH_PORT and HEALTH_STALENESS_SECONDS differ per service.
        const baseEnvironment: Record<string, string> = {
            NODE_ENV: 'production',
            WORKER_CONCURRENCY: String(concurrency),
            SHUTDOWN_GRACE_SECONDS: String(grace),
            LOCK_STALENESS_MINUTES: String(staleness),
            TARGET_DYNAMODB_TABLE: props.multiTenancyTableName,
            TARGET_DYNAMODB_REGION: props.awsRegion,
            AWS_REGION: props.awsRegion,
            DEBUG_OVERRIDE_PARAMETER_NAME: props.debugOverrideParameterName ?? '',
            ACTION_QUEUE_SQL_PREFILTER_ENABLED: 'true',
            AUTOMATED_ASSIGNMENT_SQL_PREFILTER_ENABLED: 'true',
            DB_TARGET: 'replica',
            SQL_GUARD_MODE: process.env.SQL_GUARD_MODE || 'enforce',
        };

        // Two services from the SAME image, selected by WORKER_MODE. Splitting AnsCalculateJob
        // (heavy, synchronous, event-loop-blocking SLA recalc) into its own task means a freeze can
        // only recycle the isolated `ans` task — never the `fast` worker or its /health probe.
        const addWorkerService = (
            idPrefix: string,
            serviceOpts: {
                workerMode: 'fast' | 'ans';
                healthPort: number;
                healthStalenessSeconds: number;
                memoryReservationMiB: number;
                logGroup: LogGroup;
            }
        ): void => {
            const taskDefinition = new Ec2TaskDefinition(this, `${idPrefix}TaskDef`, {
                networkMode: NetworkMode.AWS_VPC,
                taskRole,
            });

            const container = taskDefinition.addContainer('worker', {
                image: ContainerImage.fromDockerImageAsset(image),
                essential: true,
                memoryReservationMiB: serviceOpts.memoryReservationMiB,
                stopTimeout: Duration.seconds(grace),
                healthCheck: {
                    command: ['CMD-SHELL', `curl -fsS http://localhost:${serviceOpts.healthPort}/health || exit 1`],
                    interval: Duration.seconds(healthCheckIntervalSec),
                    timeout: Duration.seconds(healthCheckTimeoutSec),
                    retries: healthCheckRetries,
                    startPeriod: Duration.seconds(healthCheckStartPeriodSec),
                },
                environment: {
                    ...baseEnvironment,
                    WORKER_MODE: serviceOpts.workerMode,
                    HEALTH_PORT: String(serviceOpts.healthPort),
                    HEALTH_STALENESS_SECONDS: String(serviceOpts.healthStalenessSeconds),
                },
                logging: LogDriver.awsLogs({
                    streamPrefix: 'worker',
                    logGroup: serviceOpts.logGroup,
                }),
            });

            container.addPortMappings({ containerPort: serviceOpts.healthPort });

            new Ec2Service(this, `${idPrefix}Service`, {
                cluster,
                taskDefinition,
                desiredCount: 1,
                minHealthyPercent,
                maxHealthyPercent,
                propagateTags: PropagatedTagSource.SERVICE,
                securityGroups: [workerSg],
                // Without it a task that can never start (e.g. no free IPs in the subnets) keeps the
                // stack waiting ~3 h before CloudFormation gives up.
                circuitBreaker: { rollback: true },
                capacityProviderStrategies: [
                    {
                        capacityProvider: capacityProvider.capacityProviderName,
                        weight: 1,
                        base: 1,
                    },
                ],
            });
        };

        // Fast worker keeps the original construct ids ('Worker*') so this is an in-place update of
        // the existing service — it just gains WORKER_MODE=fast and stops running AnsCalculateJob.
        addWorkerService('Worker', {
            workerMode: 'fast',
            healthPort: 8080,
            healthStalenessSeconds: props.healthStalenessSeconds ?? 300,
            memoryReservationMiB: props.fastMemoryReservationMiB ?? 2048,
            logGroup: fastLogGroup,
        });

        // ANS worker: own task + health port, and a much longer staleness so its legitimate
        // multi-minute SLA recalculation is never killed mid-run by the /health probe.
        addWorkerService('WorkerAns', {
            workerMode: 'ans',
            healthPort: 8081,
            healthStalenessSeconds: props.ansHealthStalenessSeconds ?? 1800,
            memoryReservationMiB: props.ansMemoryReservationMiB ?? 1536,
            logGroup: ansLogGroup,
        });
    }
}
