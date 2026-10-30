import { App } from 'aws-cdk-lib';
import { InstanceClass, InstanceSize, InstanceType } from 'aws-cdk-lib/aws-ec2';
import { config } from 'dotenv';
import { ActionsQueueExecutionsWorkerStack } from '../lib/actions_queue_executions_worker-stack';

config({ path: '../../../.env' });

const app = new App();

const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';
const account = process.env.CDK_DEFAULT_ACCOUNT;

const instanceTypeFromContext = app.node.tryGetContext('instanceType') as string | undefined;
const instanceTypeFromEnv = process.env.WORKER_INSTANCE_TYPE;
const instanceTypeRaw = instanceTypeFromContext ?? instanceTypeFromEnv ?? 'm5.large';

const [classRaw, sizeRaw] = instanceTypeRaw.split('.');
if (!classRaw || !sizeRaw) {
    throw new Error(
        `Invalid instanceType "${instanceTypeRaw}". Expected format "<class>.<size>" e.g. "t3.medium". Override via "cdk deploy -c instanceType=t3.large" or env WORKER_INSTANCE_TYPE.`
    );
}

const findEnumValue = <T extends Record<string, string>>(enumObj: T, value: string): T[keyof T] | undefined => {
    const lower = value.toLowerCase();
    return Object.values(enumObj).find((v) => v.toLowerCase() === lower) as T[keyof T] | undefined;
};

const instanceClassValue = findEnumValue(InstanceClass, classRaw);
const instanceSizeValue = findEnumValue(InstanceSize, sizeRaw);
if (!instanceClassValue || !instanceSizeValue) {
    throw new Error(
        `Invalid instanceType "${instanceTypeRaw}". Unknown class "${classRaw}" or size "${sizeRaw}". Examples: "t3.medium", "m5.2xlarge", "c5.12xlarge".`
    );
}
const instanceType = InstanceType.of(instanceClassValue, instanceSizeValue);

const appsServiceName = process.env.APPS_SERVICE_NAME ?? 'kace';
const multiTenancyTableName =
    process.env.AWS_DYNAMODB_MULTITENANT_TABLE_NAME ?? `${appsServiceName}_kace_multi_tenancy`;

const debugOverrideParameterName =
    process.env.WORKER_DEBUG_PARAMETER_NAME ?? `/kace/${appsServiceName}/worker-actions-queue-executions/log-debug`;

const awsEventBridgeEventBusArn = process.env.AWS_EVENTBRIDGE_EVENT_BUS_ARN as string;
const awsCasesEventsQueueArn = process.env.AWS_CASES_EVENTS_QUEUE_ARN;
const awsActionJobsEventsQueueArn = process.env.AWS_ACTION_JOBS_EVENTS_QUEUE_ARN;
const awsAutomatedActionsEventsQueueArn = process.env.AWS_AUTOMATED_ACTIONS_EVENTS_QUEUE_ARN;
const awsWsRestEventsQueueArn = process.env.AWS_WS_REST_EVENTS_QUEUE_ARN;

new ActionsQueueExecutionsWorkerStack(app, 'ActionsQueueExecutionsWorkerStack', {
    env: { account, region },
    instanceType,
    appsServiceName,
    workerConcurrency: process.env.WORKER_CONCURRENCY ? Number(process.env.WORKER_CONCURRENCY) : undefined,
    healthStalenessSeconds: process.env.HEALTH_STALENESS_SECONDS
        ? Number(process.env.HEALTH_STALENESS_SECONDS)
        : undefined,
    ansHealthStalenessSeconds: process.env.ANS_HEALTH_STALENESS_SECONDS
        ? Number(process.env.ANS_HEALTH_STALENESS_SECONDS)
        : undefined,
    fastMemoryReservationMiB: process.env.WORKER_FAST_MEMORY_MIB
        ? Number(process.env.WORKER_FAST_MEMORY_MIB)
        : undefined,
    ansMemoryReservationMiB: process.env.WORKER_ANS_MEMORY_MIB ? Number(process.env.WORKER_ANS_MEMORY_MIB) : undefined,
    shutdownGracePeriodSec: process.env.SHUTDOWN_GRACE_SECONDS ? Number(process.env.SHUTDOWN_GRACE_SECONDS) : undefined,
    lockStalenessMinutes: process.env.LOCK_STALENESS_MINUTES ? Number(process.env.LOCK_STALENESS_MINUTES) : undefined,
    minHealthyPercent: process.env.WORKER_MIN_HEALTHY_PERCENT
        ? Number(process.env.WORKER_MIN_HEALTHY_PERCENT)
        : undefined,
    maxHealthyPercent: process.env.WORKER_MAX_HEALTHY_PERCENT
        ? Number(process.env.WORKER_MAX_HEALTHY_PERCENT)
        : undefined,
    healthCheckIntervalSec: process.env.WORKER_HEALTHCHECK_INTERVAL_SEC
        ? Number(process.env.WORKER_HEALTHCHECK_INTERVAL_SEC)
        : undefined,
    healthCheckTimeoutSec: process.env.WORKER_HEALTHCHECK_TIMEOUT_SEC
        ? Number(process.env.WORKER_HEALTHCHECK_TIMEOUT_SEC)
        : undefined,
    healthCheckRetries: process.env.WORKER_HEALTHCHECK_RETRIES
        ? Number(process.env.WORKER_HEALTHCHECK_RETRIES)
        : undefined,
    healthCheckStartPeriodSec: process.env.WORKER_HEALTHCHECK_START_PERIOD_SEC
        ? Number(process.env.WORKER_HEALTHCHECK_START_PERIOD_SEC)
        : undefined,
    vpcId: process.env.AWS_EC2_VPC_ID,
    vpcAvailabilityZones: process.env.AWS_EC2_VPC_AVAILABILITY_ZONES?.split(','),
    vpcPrivateSubnetIds: process.env.AWS_EC2_VPC_SUBNET_PRIVATE_IDS?.split(','),
    vpcPrivateSubnetRouteTableIds: process.env.AWS_EC2_VPC_PRIVATE_SUBNET_ROUTE_TABLE_IDS?.split(','),
    securityGroupId: process.env.AWS_EC2_WORKER_SECURITY_GROUP_ID,
    multiTenancyTableName,
    awsRegion: region,
    debugOverrideParameterName,
    awsEventBridgeEventBusArn,
    awsCasesEventsQueueArn,
    awsActionJobsEventsQueueArn,
    awsAutomatedActionsEventsQueueArn,
    awsWsRestEventsQueueArn,
});
