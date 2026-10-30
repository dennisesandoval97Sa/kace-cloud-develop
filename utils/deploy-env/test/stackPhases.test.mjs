import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cdkBootstrap } from '../phases/cdkBootstrap.mjs';
import { eventProcessorStack } from '../phases/eventProcessorStack.mjs';
import { infraStack } from '../phases/infraStack.mjs';
import { classifyStackStatus, createStackPhase } from '../phases/stackPhase.mjs';
import { tenantStack } from '../phases/tenantStack.mjs';
import { makeCtx } from './helpers.mjs';

const MISSING = { code: 254, stderr: 'An error occurred (ValidationError): Stack with id X does not exist' };
const stackJson = (status, outputs = []) => ({
    stdout: JSON.stringify({ Stacks: [{ StackStatus: status, Outputs: outputs }] }),
});

describe('classifyStackStatus', () => {
    it('clasifica los estados de CloudFormation', () => {
        assert.equal(classifyStackStatus(null), 'missing');
        assert.equal(classifyStackStatus('CREATE_COMPLETE'), 'ready');
        assert.equal(classifyStackStatus('UPDATE_COMPLETE'), 'ready');
        assert.equal(classifyStackStatus('UPDATE_ROLLBACK_COMPLETE'), 'ready');
        assert.equal(classifyStackStatus('ROLLBACK_COMPLETE'), 'failed');
        assert.equal(classifyStackStatus('CREATE_FAILED'), 'failed');
        assert.equal(classifyStackStatus('UPDATE_ROLLBACK_FAILED'), 'failed');
        assert.equal(classifyStackStatus('UPDATE_IN_PROGRESS'), 'busy');
    });
});

describe('createStackPhase', () => {
    const phase = createStackPhase({
        name: 'tenant-stack',
        stackId: 'TenantStack',
        command: ['pnpm', '--filter', '@kace/api-tenant', 'run', 'cdk:deploy'],
    });

    it('isDone=true con el stack sano y consulta el nombre derivado de APPS_SERVICE_NAME', async () => {
        // Arrange
        const { ctx, calls } = makeCtx({
            envText: 'APPS_SERVICE_NAME=MULTI\n',
            routes: [{ match: 'describe-stacks', result: stackJson('UPDATE_COMPLETE') }],
        });

        // Act
        const done = await phase.isDone(ctx);

        // Assert
        assert.equal(done, true);
        assert.ok(calls[0].line.includes('--stack-name MULTITenantStack'));
        assert.equal(phase.needsActiveEnv, true);
    });

    it('isDone=false si el stack no existe', async () => {
        // Arrange
        const { ctx } = makeCtx({ routes: [{ match: 'describe-stacks', result: MISSING }] });

        // Act / Assert
        assert.equal(await phase.isDone(ctx), false);
    });

    for (const status of ['ROLLBACK_COMPLETE', 'UPDATE_ROLLBACK_FAILED', 'UPDATE_IN_PROGRESS']) {
        it(`aborta sin borrar nada si el stack está en ${status}`, async () => {
            // Arrange
            const { ctx, calls } = makeCtx({ routes: [{ match: 'describe-stacks', result: stackJson(status) }] });

            // Act / Assert
            await assert.rejects(phase.isDone(ctx), new RegExp(status));
            assert.equal(
                calls.some((call) => /delete-stack|cancel-update-stack/.test(call.line)),
                false
            );
        });
    }

    it('run lanza el comando en streaming', async () => {
        // Arrange
        const { ctx, calls } = makeCtx();

        // Act
        await phase.run(ctx);

        // Assert
        assert.equal(calls[0].line, 'pnpm --filter @kace/api-tenant run cdk:deploy');
        assert.equal(calls[0].opts.stream, true);
    });

    it('sync escribe los outputs mapeados en el .env', async () => {
        // Arrange
        const arn = 'arn:aws:dynamodb:us-east-1:123456789012:table/svc_kace_multi_tenancy';
        const { ctx, file } = makeCtx({
            envText: 'APPS_SERVICE_NAME=svc\nAWS_DYNAMODB_MULTITENANT_TABLE_ARN=\n',
            routes: [
                {
                    match: 'describe-stacks',
                    result: stackJson('CREATE_COMPLETE', [{ OutputKey: 'OutputTableArn', OutputValue: arn }]),
                },
            ],
        });

        // Act
        await phase.sync(ctx);

        // Assert
        assert.match(readFileSync(file, 'utf8'), new RegExp(`^AWS_DYNAMODB_MULTITENANT_TABLE_ARN=${arn}$`, 'm'));
        assert.equal(ctx.env.AWS_DYNAMODB_MULTITENANT_TABLE_ARN, arn);
    });

    it('sync falla si falta un output esperado', async () => {
        // Arrange
        const { ctx } = makeCtx({ routes: [{ match: 'describe-stacks', result: stackJson('CREATE_COMPLETE', []) }] });

        // Act / Assert
        await assert.rejects(phase.sync(ctx), /le faltan outputs: OutputTableArn/);
    });

    it('sync en dry-run con el stack inexistente no falla', async () => {
        // Arrange
        const { ctx, output } = makeCtx({
            flags: { dryRun: true },
            routes: [{ match: 'describe-stacks', result: MISSING }],
        });

        // Act
        await phase.sync(ctx);

        // Assert
        assert.match(output.join(''), /no existe todavía/);
    });

    it('sync fuera de dry-run con el stack inexistente falla', async () => {
        // Arrange
        const { ctx } = makeCtx({ routes: [{ match: 'describe-stacks', result: MISSING }] });

        // Act / Assert
        await assert.rejects(phase.sync(ctx), /no existe después del deploy/);
    });
});

describe('fases concretas', () => {
    it('infra-stack se redespliega siempre aunque el stack esté sano', async () => {
        // Arrange
        const { ctx } = makeCtx({ routes: [{ match: 'describe-stacks', result: stackJson('UPDATE_COMPLETE') }] });

        // Act / Assert
        assert.equal(infraStack.name, 'infra-stack');
        assert.equal(await infraStack.isDone(ctx), false);
    });

    it('infra-stack aborta igualmente si el stack está roto', async () => {
        // Arrange
        const { ctx } = makeCtx({ routes: [{ match: 'describe-stacks', result: stackJson('ROLLBACK_COMPLETE') }] });

        // Act / Assert
        await assert.rejects(infraStack.isDone(ctx), /ROLLBACK_COMPLETE/);
    });

    it('los comandos de cada fase son los del procedimiento actual', async () => {
        // Arrange
        const { ctx, calls } = makeCtx();

        // Act
        await infraStack.run(ctx);
        await tenantStack.run(ctx);
        await eventProcessorStack.run(ctx);
        await cdkBootstrap.run(ctx);

        // Assert
        assert.deepEqual(
            calls.map((call) => call.line),
            [
                'pnpm --filter @kace/aws-infra exec cdk deploy --require-approval never',
                'pnpm --filter @kace/api-tenant run cdk:deploy',
                'pnpm --filter @kace/api-event-processor run cdk:deploy',
                'pnpm --filter @kace/aws-infra exec cdk bootstrap',
            ]
        );
    });

    it('cdk-bootstrap está hecho si existe CDKToolkit', async () => {
        // Arrange
        const { ctx, calls } = makeCtx({ routes: [{ match: 'CDKToolkit', result: stackJson('UPDATE_COMPLETE') }] });

        // Act
        const done = await cdkBootstrap.isDone(ctx);

        // Assert
        assert.equal(done, true);
        assert.ok(calls[0].line.includes('--stack-name CDKToolkit'));
        assert.equal(cdkBootstrap.needsActiveEnv, true);
    });
});
