import { loadConfig } from './config.mjs';
import { Scheduler } from './Scheduler.mjs';
import { Health } from './Health.mjs';
import { TenantEnumerator } from './TenantEnumerator.mjs';
import { JobRunner } from './JobRunner.mjs';
import { DebugOverride } from './DebugOverride.mjs';
import { ActionsQueueJob } from './jobs/ActionsQueueJob.mjs';
import { AutomatedAssignmentJob } from './jobs/AutomatedAssignmentJob.mjs';
import { UsersActionsJob } from './jobs/UsersActionsJob.mjs';
import { GroupsActionsJob } from './jobs/GroupsActionsJob.mjs';
import { AutomatedAssignmentBacklogJob } from './jobs/AutomatedAssignmentBacklogJob.mjs';
import {
    ANS_SCHEDULE,
    BACKLOG_SCHEDULE,
    FAST_SCHEDULE,
    createTenantCronSelector,
    resolveTenantCron,
} from './tenantCronSelector.mjs';
import { AnsCalculateJob } from './jobs/AnsCalculateJob.mjs';
import { resolveActiveSchedulers } from './resolveActiveSchedulers.mjs';
import { Helper } from '@kace/core/src/shared/index.js';

const EVERY_MINUTE = '* * * * *';

const main = async () => {
    const config = loadConfig();
    Helper.logInfo('worker.boot', config);

    const enumerator = new TenantEnumerator();
    const fastJobs = [
        new ActionsQueueJob(),
        new AutomatedAssignmentJob(),
        new UsersActionsJob(),
        new GroupsActionsJob(),
    ];
    const ansJobs = [new AnsCalculateJob()];
    const fastRunners = fastJobs.map((job) => new JobRunner({ job, concurrency: config.workerConcurrency }));
    const ansRunners = ansJobs.map((job) => new JobRunner({ job, concurrency: config.workerConcurrency }));
    const backlogJobs = [new AutomatedAssignmentBacklogJob()];
    const backlogRunners = backlogJobs.map((job) => new JobRunner({ job, concurrency: config.workerConcurrency }));

    const debugOverride = new DebugOverride({
        parameterName: config.debugOverrideParameterName,
        region: config.awsRegion,
    });

    // Initial fetch — best effort, capped at 1s so a slow/failing SSM does not
    // block container boot. fetchAndApply() always defaults to OFF on failure.
    await Promise.race([debugOverride.fetchAndApply(), new Promise((r) => setTimeout(r, 1000))]);

    // Each runner has its own selector: a busy runner keeps its fires pending without holding back the others.
    const withSchedule = (runner, schedule) => ({
        runner,
        selectTenants: createTenantCronSelector({
            resolveCron: (tenant) => resolveTenantCron(tenant, schedule),
            isBusy: () => runner.inFlight !== null,
            invalidLogKey: 'worker.schedule.invalid',
            logContext: { job: runner.name },
        }),
    });

    const buildTick = (entries, label) => async () => {
        const tickAt = new Date();
        await debugOverride.fetchAndApply();
        const tenants = await enumerator.list();
        Helper.logDebug('tick.tenants', {
            scheduler: label,
            count: tenants.length,
            concurrency: config.workerConcurrency,
            jobs: entries.map(({ runner }) => runner.name),
        });
        for (const { runner, selectTenants } of entries) {
            const due = selectTenants(tenants, tickAt);
            if (due.length > 0) runner.runIfIdle({ tenants: due });
        }
    };

    // Every scheduler ticks each minute; each tenant runs a job only when its own cron
    // (tenant record, DynamoDB) has fired for it.
    const fastScheduler = new Scheduler({
        tick: buildTick(
            fastRunners.map((runner) => withSchedule(runner, FAST_SCHEDULE)),
            'fast'
        ),
        cronExpression: EVERY_MINUTE,
        runners: fastRunners,
    });
    const ansScheduler = new Scheduler({
        tick: buildTick(
            ansRunners.map((runner) => withSchedule(runner, ANS_SCHEDULE)),
            'ans'
        ),
        cronExpression: EVERY_MINUTE,
        runners: ansRunners,
    });
    // Own scheduler + runner: never shares a tick or an in-flight slot with AnsCalculateJob.
    const backlogScheduler = new Scheduler({
        tick: buildTick(
            backlogRunners.map((runner) => withSchedule(runner, BACKLOG_SCHEDULE)),
            'backlog'
        ),
        cronExpression: EVERY_MINUTE,
        runners: backlogRunners,
    });
    // WORKER_MODE selects which schedulers this process actually starts. The `fast` worker never
    // starts the ANS scheduler, so AnsCalculateJob can never freeze its event loop / health probe.
    const schedulers = resolveActiveSchedulers(config.workerMode, {
        fast: fastScheduler,
        ans: ansScheduler,
        backlog: backlogScheduler,
    });
    Helper.logInfo('worker.mode', { mode: config.workerMode, schedulers: schedulers.length });

    const health = new Health({ port: config.healthPort });
    await health.start(() => schedulers.every((s) => s.isHealthy()));
    for (const scheduler of schedulers) {
        scheduler.start();
    }

    const drainTimeoutMs = Math.max(config.shutdownGraceSeconds - 120, 60) * 1000;

    let shuttingDown = false;
    const shutdown = async (signal) => {
        if (shuttingDown) return;
        shuttingDown = true;
        Helper.logInfo('worker.shutdown', { signal });
        for (const scheduler of schedulers) {
            scheduler.beginShutdown();
        }
        await Promise.all(schedulers.map((s) => s.drain(drainTimeoutMs)));
        await Promise.all(schedulers.map((s) => s.stop()));
        await health.stop();
        process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
};

main().catch((error) => {
    process.stderr.write(`worker.fatal ${error?.stack || error?.message || error}\n`);
    process.exit(1);
});
