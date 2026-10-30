import {
    SchedulerClient,
    CreateScheduleCommand,
    UpdateScheduleCommand,
    DeleteScheduleCommand,
    GetScheduleCommand,
} from '@aws-sdk/client-scheduler';

export const SCHEDULE_SOURCE_MARKER = 'kace-debug-scheduled-disable';

export class DebugScheduler {
    #client;
    #lambdaArn;
    #roleArn;
    #groupName;

    constructor({ client, lambdaArn, roleArn, groupName } = {}) {
        this.#client = client ?? new SchedulerClient({});
        this.#lambdaArn = lambdaArn ?? process.env.DEBUG_TOGGLE_LAMBDA_ARN;
        this.#roleArn = roleArn ?? process.env.DEBUG_TOGGLE_SCHEDULER_ROLE_ARN;
        this.#groupName = groupName ?? process.env.DEBUG_TOGGLE_SCHEDULE_GROUP ?? 'default';
    }

    scheduleName(targetKebab) {
        return `debug-disable-${targetKebab}`.slice(0, 64);
    }

    #atExpression(date) {
        return `at(${date.toISOString().slice(0, 19)})`;
    }

    #buildParams(targetKebab, fireAt, tenantId, target) {
        return {
            Name: this.scheduleName(targetKebab),
            GroupName: this.#groupName,
            ScheduleExpression: this.#atExpression(fireAt),
            ScheduleExpressionTimezone: 'UTC',
            FlexibleTimeWindow: { Mode: 'OFF' },
            ActionAfterCompletion: 'DELETE',
            Target: {
                Arn: this.#lambdaArn,
                RoleArn: this.#roleArn,
                Input: JSON.stringify({
                    source: SCHEDULE_SOURCE_MARKER,
                    target,
                    tenantId: tenantId ?? null,
                }),
            },
        };
    }

    async scheduleDisable(targetKebab, minutes, tenantId = null, target = targetKebab) {
        const fireAt = new Date(Date.now() + minutes * 60_000);
        const params = this.#buildParams(targetKebab, fireAt, tenantId, target);

        try {
            await this.#client.send(new CreateScheduleCommand(params));
        } catch (err) {
            if (err?.name === 'ConflictException') {
                await this.#client.send(new UpdateScheduleCommand(params));
            } else {
                throw err;
            }
        }

        return {
            expiresAt: fireAt.toISOString(),
            scheduleName: params.Name,
        };
    }

    async cancelPending(targetKebab) {
        try {
            await this.#client.send(
                new DeleteScheduleCommand({
                    Name: this.scheduleName(targetKebab),
                    GroupName: this.#groupName,
                })
            );
            return { canceled: true };
        } catch (err) {
            if (err?.name === 'ResourceNotFoundException') return { canceled: false };
            throw err;
        }
    }

    async getPending(targetKebab) {
        try {
            const resp = await this.#client.send(
                new GetScheduleCommand({
                    Name: this.scheduleName(targetKebab),
                    GroupName: this.#groupName,
                })
            );
            const match = resp.ScheduleExpression?.match(/^at\((.+)\)$/);
            const expiresAt = match ? new Date(`${match[1]}Z`).toISOString() : null;
            return { expiresAt };
        } catch (err) {
            if (err?.name === 'ResourceNotFoundException') return { expiresAt: null };
            throw err;
        }
    }
}
