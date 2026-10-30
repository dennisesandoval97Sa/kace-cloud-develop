import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { Helper } from '@kace/core/src/shared/index.js';

/**
 * Reads an SSM Parameter Store value at the start of every tick and writes
 * the result into `process.env.APPS_DEBUG_OVERRIDE`. The Helper logger
 * (in @kace/core) consults that env var on each call, so the worker can
 * toggle DEBUG verbosity globally without redeploying or restarting.
 *
 * Defaults to OFF on every failure mode (param missing, IAM denied, network
 * error, no parameter name configured) so the worker is silent unless an
 * operator explicitly opts in.
 */
export class DebugOverride {
    #client;
    #parameterName;

    constructor({ parameterName, region, client = null } = {}) {
        this.#parameterName = parameterName ?? '';
        this.#client = client ?? new SSMClient({ region: region ?? 'us-east-1' });
    }

    /**
     * Fetches the parameter and mutates `process.env.APPS_DEBUG_OVERRIDE`.
     * Resolves to `void` regardless of outcome — never throws.
     */
    async fetchAndApply() {
        if (!this.#parameterName) {
            process.env.APPS_DEBUG_OVERRIDE = 'false';
            return;
        }
        try {
            const result = await this.#client.send(new GetParameterCommand({ Name: this.#parameterName }));
            const raw = (result.Parameter?.Value ?? '').toLowerCase().trim();
            const enabled = raw === 'true' || raw === '1' || raw === 'on';
            process.env.APPS_DEBUG_OVERRIDE = enabled ? 'true' : 'false';
        } catch (error) {
            process.env.APPS_DEBUG_OVERRIDE = 'false';
            if (error?.name !== 'ParameterNotFound') {
                Helper.logError('DebugOverride.fetch.failed', {
                    parameterName: this.#parameterName,
                    err: error?.message,
                    errorName: error?.name,
                });
            }
        }
    }
}
