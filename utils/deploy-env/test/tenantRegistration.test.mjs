import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { AbortedError } from '../errors.mjs';
import {
    diffItems,
    parseTableArn,
    stableStringify,
    tenantId,
    tenantRegistration,
} from '../phases/tenantRegistration.mjs';
import { makeCtx } from './helpers.mjs';

const ID = '11111111-1111-4111-8111-111111111111';
const ARN = 'arn:aws:dynamodb:us-east-1:123456789012:table/svc_kace_multi_tenancy';
const ENV = `APPS_SERVICE_NAME=svc\nVITE_TENANT_ID=${ID}\nAWS_DYNAMODB_MULTITENANT_TABLE_ARN=${ARN}\n`;
const GENERATED = { id: { S: ID }, db_host: { S: 'db.nuevo' }, db_password: { S: 'secreto-nuevo' } };

function routes({ existing = null, putCode = 0, puts = [] } = {}) {
    return [
        {
            match: 'generateTenantJson.mjs',
            result: (call) => {
                writeFileSync(call.args[call.args.indexOf('-o') + 1], JSON.stringify(GENERATED));
                return {};
            },
        },
        { match: 'get-item', result: { stdout: JSON.stringify(existing ? { Item: existing } : {}) } },
        {
            match: 'put-item',
            result: (call) => {
                const fileArg = call.args[call.args.indexOf('--item') + 1];
                puts.push({
                    call,
                    item: JSON.parse(readFileSync(fileArg.replace('file://', ''), 'utf8')),
                });
                return putCode ? { code: putCode, stderr: 'ConditionalCheckFailedException' } : {};
            },
        },
    ];
}

describe('helpers', () => {
    it('parseTableArn extrae región y tabla', () => {
        assert.deepEqual(parseTableArn(ARN), {
            region: 'us-east-1',
            table: 'svc_kace_multi_tenancy',
        });
        assert.throws(() => parseTableArn('no-es-arn'), /no es un ARN de tabla válido/);
    });

    it('tenantId prioriza TENANT_ID sobre VITE_TENANT_ID', () => {
        assert.equal(tenantId({ TENANT_ID: 'a', VITE_TENANT_ID: 'b' }), 'a');
        assert.equal(tenantId({ VITE_TENANT_ID: 'b' }), 'b');
        assert.equal(tenantId({}), '');
    });

    it('stableStringify no depende del orden de claves', () => {
        assert.equal(
            stableStringify({
                M: { b: { S: '1' }, a: { S: '2' } },
            }),
            stableStringify({
                M: { a: { S: '2' }, b: { S: '1' } },
            })
        );
    });

    it('diffItems enmascara TODOS los campos sensibles del contrato real de Tenant, incluidos usuarios', () => {
        // Arrange
        const SENSITIVE_TENANT_FIELDS = [
            'db_password',
            'db_auxiliar_password',
            'channel_hub_password',
            'aws_css_password',
            'db_user',
            'db_auxiliar_user',
            'channel_hub_user',
            'aws_css_username',
            'aws_s3_access_key_id',
            'aws_s3_secret_access_key',
            'secret_key',
            'secret_iv',
            'webhook_api_key',
        ];

        for (const field of SENSITIVE_TENANT_FIELDS) {
            // Act
            const diff = diffItems({ [field]: { S: 'old-value' } }, { [field]: { S: 'new-value' } });

            // Assert
            assert.deepEqual(
                diff,
                [{ field, before: '****', after: '****' }],
                `${field} debería enmascararse en el diff`
            );
        }

        // Act
        const nonSensitive = diffItems({ db_host: { S: 'old-value' } }, { db_host: { S: 'new-value' } });

        // Assert
        assert.deepEqual(nonSensitive, [{ field: 'db_host', before: '"old-value"', after: '"new-value"' }]);
    });

    it('diffItems ignora campos extra del existente, enmascara sensibles y muestra el resto', () => {
        // Arrange
        const existing = {
            id: { S: ID },
            db_host: { S: 'db.viejo' },
            db_password: { S: 'x' },
            extra: { S: 'backfill' },
        };

        // Act
        const diff = diffItems(existing, GENERATED);

        // Assert
        assert.deepEqual(diff, [
            { field: 'db_host', before: '"db.viejo"', after: '"db.nuevo"' },
            { field: 'db_password', before: '****', after: '****' },
        ]);
    });
});

describe('tenantRegistration', () => {
    it('isDone=false sin tabla en dry-run (entorno nuevo) sin fallar', async () => {
        // Arrange
        const { ctx } = makeCtx({
            envText: `APPS_SERVICE_NAME=svc\nVITE_TENANT_ID=${ID}\n`,
            flags: { dryRun: true },
        });

        // Act / Assert
        assert.equal(await tenantRegistration.isDone(ctx), false);
    });

    it('isDone=true si el item existe y es igual', async () => {
        // Arrange
        const { ctx, calls } = makeCtx({ envText: ENV, routes: routes({ existing: GENERATED }) });

        // Act
        const done = await tenantRegistration.isDone(ctx);

        // Assert
        assert.equal(done, true);
        const get = calls.find((call) => call.line.includes('get-item'));
        assert.ok(get.line.includes('--table-name svc_kace_multi_tenancy'));
        assert.ok(get.line.includes('--consistent-read'));
        const generate = calls.find((call) => call.line.includes('generateTenantJson.mjs'));
        assert.deepEqual(generate.args.slice(1, 5), [ctx.envFile, '--id', ID, '--dynamodb']);
    });

    it('run registra con put-item condicional si no existe', async () => {
        // Arrange
        const puts = [];
        const { ctx } = makeCtx({ envText: ENV, routes: routes({ puts }) });

        // Act
        const outcome = await tenantRegistration.run(ctx);

        // Assert
        assert.equal(outcome, undefined);
        assert.equal(puts.length, 1);
        assert.deepEqual(puts[0].item, GENERATED);
        assert.ok(puts[0].call.line.includes('--condition-expression attribute_not_exists(id)'));
    });

    it('run devuelve warning y no escribe si difiere sin --overwrite-tenant', async () => {
        // Arrange
        const puts = [];
        const existing = { ...GENERATED, db_host: { S: 'db.viejo' } };
        const { ctx, output } = makeCtx({ envText: ENV, routes: routes({ existing, puts }) });

        // Act
        const outcome = await tenantRegistration.run(ctx);

        // Assert
        assert.equal(puts.length, 0);
        assert.match(outcome.warning, /no sobrescrito.*--overwrite-tenant/);
        assert.match(output.join(''), /~ db_host: "db.viejo" → "db.nuevo"/);
        assert.doesNotMatch(output.join(''), /secreto-nuevo/);
    });

    it('run con --overwrite-tenant --yes fusiona conservando campos extra, sin condición', async () => {
        // Arrange
        const puts = [];
        const existing = { ...GENERATED, db_host: { S: 'db.viejo' }, extra: { S: 'backfill' } };
        const { ctx } = makeCtx({
            envText: ENV,
            flags: { overwriteTenant: true, yes: true },
            routes: routes({ existing, puts }),
        });

        // Act
        await tenantRegistration.run(ctx);

        // Assert
        assert.deepEqual(puts[0].item, { ...GENERATED, extra: { S: 'backfill' } });
        assert.equal(puts[0].call.line.includes('--condition-expression'), false);
    });

    it('run con --overwrite-tenant sin --yes aborta si se rechaza', async () => {
        // Arrange
        const puts = [];
        const existing = { ...GENERATED, db_host: { S: 'db.viejo' } };
        const { ctx } = makeCtx({
            envText: ENV,
            flags: { overwriteTenant: true },
            routes: routes({ existing, puts }),
            answers: [false],
        });

        // Act / Assert
        await assert.rejects(tenantRegistration.run(ctx), AbortedError);
        assert.equal(puts.length, 0);
    });

    it('run falla si no hay id de tenant', async () => {
        // Arrange
        const { ctx } = makeCtx({
            envText: `APPS_SERVICE_NAME=svc\nAWS_DYNAMODB_MULTITENANT_TABLE_ARN=${ARN}\n`,
        });

        // Act / Assert
        await assert.rejects(tenantRegistration.run(ctx), /preflight debió generarlo/);
    });

    it('run propaga el fallo de generateTenantJson', async () => {
        // Arrange
        const { ctx } = makeCtx({
            envText: ENV,
            routes: [
                {
                    match: 'generateTenantJson.mjs',
                    result: { code: 1, stderr: 'faltan campos requeridos' },
                },
            ],
        });

        // Act / Assert
        await assert.rejects(tenantRegistration.run(ctx), /generateTenantJson falló:\nfaltan campos requeridos/);
    });

    it('plan sin ARN de tabla y con id no llama a nada', async () => {
        // Arrange
        const { ctx, calls } = makeCtx({
            envText: `APPS_SERVICE_NAME=svc\nVITE_TENANT_ID=${ID}\n`,
            flags: { dryRun: true },
        });

        // Act
        const lines = await tenantRegistration.plan(ctx);

        // Assert
        assert.deepEqual(lines, [
            `La tabla de tenants aún no existe (la crea tenant-stack): se registrará el tenant ${ID}`,
        ]);
        assert.equal(calls.length, 0);
    });

    it('plan sin ARN ni id indica que lo generará preflight, sin llamadas', async () => {
        // Arrange
        const { ctx, calls } = makeCtx({ envText: 'APPS_SERVICE_NAME=svc\n', flags: { dryRun: true } });

        // Act
        const lines = await tenantRegistration.plan(ctx);

        // Assert
        assert.deepEqual(lines, [
            'La tabla de tenants aún no existe (la crea tenant-stack): se registrará el tenant con el id que genere preflight',
        ]);
        assert.equal(calls.length, 0);
    });

    it('plan con item nuevo dice que se registraría, sin put-item', async () => {
        // Arrange
        const puts = [];
        const { ctx, calls } = makeCtx({ envText: ENV, routes: routes({ puts }) });

        // Act
        const lines = await tenantRegistration.plan(ctx);

        // Assert
        assert.deepEqual(lines, [`Se registraría el tenant ${ID} en svc_kace_multi_tenancy`]);
        assert.equal(
            calls.some((call) => call.line.includes('put-item')),
            false
        );
    });

    it('plan con diferencias muestra el diff enmascarado y el aviso de overwrite', async () => {
        // Arrange
        const puts = [];
        const existing = { ...GENERATED, db_host: { S: 'db.viejo' }, db_password: { S: 'secreto-viejo' } };
        const { ctx, calls } = makeCtx({ envText: ENV, routes: routes({ existing, puts }) });

        // Act
        const lines = await tenantRegistration.plan(ctx);

        // Assert
        const text = lines.join('\n');
        assert.match(text, /~ db_host: "db.viejo" → "db.nuevo"/);
        assert.match(text, /~ db_password: \*\*\*\* → \*\*\*\*/);
        assert.doesNotMatch(text, /secreto/);
        assert.equal(lines.at(-1), 'Sin --overwrite-tenant no se sobrescribe (terminará en aviso).');
        assert.equal(
            calls.some((call) => call.line.includes('put-item')),
            false
        );
    });

    it('plan con diferencias y --overwrite-tenant omite el aviso', async () => {
        // Arrange
        const existing = { ...GENERATED, db_host: { S: 'db.viejo' } };
        const { ctx } = makeCtx({
            envText: ENV,
            flags: { overwriteTenant: true },
            routes: routes({ existing }),
        });

        // Act
        const lines = await tenantRegistration.plan(ctx);

        // Assert
        assert.equal(
            lines.some((line) => line.includes('Sin --overwrite-tenant')),
            false
        );
        assert.ok(lines.some((line) => line.includes('~ db_host')));
    });
});
