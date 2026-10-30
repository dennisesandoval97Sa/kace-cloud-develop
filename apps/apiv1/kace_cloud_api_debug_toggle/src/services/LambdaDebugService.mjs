import {
    LambdaClient,
    GetFunctionConfigurationCommand,
    UpdateFunctionConfigurationCommand,
} from '@aws-sdk/client-lambda';
import { CloudFormationClient, ListStackResourcesCommand } from '@aws-sdk/client-cloudformation';

const RESOLVE_CACHE_TTL_MS = 5 * 60 * 1000;

// CDK-generated helper Lambdas that may live in an API stack but are NOT the handler.
const HELPER_LOGICAL_ID = /LogRetention|BucketNotifications|Custom|Provider|framework|AwsCdk/i;

export class LambdaDebugService {
    #client;
    #cfnClient;
    #serviceName;
    #resolveCache = new Map();

    constructor({ client, cfnClient, serviceName } = {}) {
        this.#client = client ?? new LambdaClient({});
        this.#cfnClient = cfnClient ?? new CloudFormationClient({});
        this.#serviceName = serviceName ?? process.env.APPS_SERVICE_NAME ?? '';
    }

    /**
     * Reduces a CDK Stack id to a safe key (lowercase alphanumeric) for use as a
     * deterministic schedule name. e.g. "UsersStack" -> "usersstack".
     * The target MUST be the CDK Stack id (the authoritative identifier); it is
     * prepended with APPS_SERVICE_NAME to obtain the deployed CloudFormation stack name.
     */
    normalizeTarget(target) {
        return String(target ?? '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
    }

    /**
     * Resolves the real, non-truncated Lambda physical name by asking CloudFormation
     * for the AWS::Lambda::Function resource inside the stack `{serviceName}{StackId}`.
     * This avoids CloudFormation's 64-char truncation of auto-generated function names,
     * which makes name-based matching against ListFunctions unreliable.
     */
    async resolveFunctionName(target) {
        const stackId = String(target ?? '').trim();
        if (!stackId) {
            const err = new Error('Empty target');
            err.statusCode = 400;
            throw err;
        }

        const stackName = `${this.#serviceName}${stackId}`;
        const now = Date.now();
        const cached = this.#resolveCache.get(stackName);
        if (cached && cached.expiresAt > now) return cached.fnName;

        const lambdaResources = await this.#listStackLambdas(stackName, target);
        const main = lambdaResources.filter((r) => !HELPER_LOGICAL_ID.test(r.LogicalResourceId ?? ''));

        if (main.length === 0) {
            const err = new Error(
                `No Lambda found in stack '${stackName}'. Use the CDK Stack id (e.g. 'UsersStack'); does that stack exist?`
            );
            err.statusCode = 404;
            throw err;
        }
        if (main.length > 1) {
            const err = new Error(`Ambiguous target '${target}': ${main.length} Lambdas in stack '${stackName}'`);
            err.statusCode = 409;
            err.matches = main.map((r) => ({
                logicalId: r.LogicalResourceId,
                physicalName: r.PhysicalResourceId,
            }));
            throw err;
        }

        const fnName = main[0].PhysicalResourceId;
        this.#resolveCache.set(stackName, { fnName, expiresAt: now + RESOLVE_CACHE_TTL_MS });
        return fnName;
    }

    async #listStackLambdas(stackName, target) {
        const resources = [];
        let nextToken;
        try {
            do {
                const resp = await this.#cfnClient.send(
                    new ListStackResourcesCommand({ StackName: stackName, NextToken: nextToken })
                );
                for (const r of resp.StackResourceSummaries ?? []) {
                    if (r.ResourceType === 'AWS::Lambda::Function') resources.push(r);
                }
                nextToken = resp.NextToken;
            } while (nextToken);
        } catch (error) {
            // Non-existent stack → CloudFormation throws ValidationError. Map to 404.
            if (error?.name === 'ValidationError' || error?.statusCode === 400) {
                const notFound = new Error(
                    `No stack found for target '${target}' (looked up '${stackName}'). Use the CDK Stack id (e.g. 'UsersStack').`
                );
                notFound.statusCode = 404;
                throw notFound;
            }
            throw error;
        }
        return resources;
    }

    async #getCurrentEnv(fnName) {
        const cfg = await this.#client.send(new GetFunctionConfigurationCommand({ FunctionName: fnName }));
        return cfg.Environment?.Variables ?? {};
    }

    async #setEnv(fnName, variables) {
        await this.#client.send(
            new UpdateFunctionConfigurationCommand({
                FunctionName: fnName,
                Environment: { Variables: variables },
            })
        );
    }

    async enable(target, level = 1) {
        const fnName = await this.resolveFunctionName(target);
        const current = await this.#getCurrentEnv(fnName);
        const previousAppsDebug = current.APPS_DEBUG ?? null;
        const previousAppsDebugLevel = current.APPS_DEBUG_LEVEL ?? null;
        const newEnv = {
            ...current,
            APPS_DEBUG: 'true',
            APPS_DEBUG_LEVEL: level === 2 ? '2' : '1',
        };
        await this.#setEnv(fnName, newEnv);
        return { fnName, previousAppsDebug, previousAppsDebugLevel };
    }

    async disable(target) {
        const fnName = await this.resolveFunctionName(target);
        const current = await this.#getCurrentEnv(fnName);
        const newEnv = {
            ...current,
            APPS_DEBUG: 'false',
            APPS_DEBUG_LEVEL: '1',
        };
        await this.#setEnv(fnName, newEnv);
        return { fnName };
    }

    async getStatus(target) {
        const fnName = await this.resolveFunctionName(target);
        const current = await this.#getCurrentEnv(fnName);
        return {
            fnName,
            APPS_DEBUG: current.APPS_DEBUG ?? null,
            APPS_DEBUG_LEVEL: current.APPS_DEBUG_LEVEL ?? null,
        };
    }
}
