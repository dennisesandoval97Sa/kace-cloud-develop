import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DERIVED_ENV_KEYS, mapOutputs, OUTPUT_MAP, stackName } from '../outputMap.mjs';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const read = (relative) => readFileSync(path.join(REPO, relative), 'utf8');

describe('OUTPUT_MAP frente al repo', () => {
    it('cada variable del mapa está declarada en .env.example', () => {
        // Arrange
        const declared = new Set([...read('.env.example').matchAll(/^([A-Z_][A-Z0-9_]*)=/gm)].map((m) => m[1]));

        // Act
        const undeclared = DERIVED_ENV_KEYS.filter((key) => !declared.has(key));

        // Assert
        assert.deepEqual(undeclared, []);
    });

    it('los outputs de AwsInfraStack y TenantStack existen en su CDK', () => {
        // Arrange
        const infra = read('packages/kace_cloud_aws_infra/lib/aws_infra-stack.ts');
        const tenant = read('apps/apiv1/kace_cloud_api_tenant/lib/tenant-stack.ts');

        // Act / Assert
        for (const key of Object.keys(OUTPUT_MAP.AwsInfraStack)) {
            assert.ok(infra.includes(`new CfnOutput(this, '${key}'`), `falta ${key} en aws_infra-stack.ts`);
        }
        for (const key of Object.keys(OUTPUT_MAP.TenantStack)) {
            assert.ok(tenant.includes(`new CfnOutput(this, '${key}'`), `falta ${key} en tenant-stack.ts`);
        }
    });

    it('hay ARN y URL de cola por cada buildBcInfra del event-processor, y nada más', () => {
        // Arrange
        const source = read('apps/apiv1/kace_cloud_api_event_processor/lib/event-processor-stack.ts');
        const prefixes = [...source.matchAll(/buildBcInfra\(\s*'([A-Za-z]+)'/g)].map((m) => m[1]);
        const expected = prefixes.flatMap((prefix) => [`${prefix}EventsQueueArn`, `${prefix}EventsQueueUrl`]).sort();

        // Act
        const mapped = Object.keys(OUTPUT_MAP.EventProcessorStack)
            .filter((key) => key !== 'EventBusArn')
            .sort();

        // Assert
        assert.equal(prefixes.length, 7);
        assert.deepEqual(mapped, expected);
        assert.ok(source.includes("new CfnOutput(this, 'EventBusArn'"));
    });
});

describe('mapOutputs', () => {
    it('traduce outputs a variables y lista los que faltan o vienen vacíos', () => {
        // Arrange
        const outputs = [
            { OutputKey: 'OutputAPIDomainName', OutputValue: 'api.example.com' },
            { OutputKey: 'OutputDomainNameAliasTarget', OutputValue: '' },
            { OutputKey: 'Irrelevante', OutputValue: 'x' },
        ];

        // Act
        const { updates, missing } = mapOutputs('AwsInfraStack', outputs);

        // Assert
        assert.deepEqual(updates, { AWS_APIGATEWAY_DOMAIN_NAME: 'api.example.com' });
        assert.deepEqual(missing, ['OutputDomainNameAliasTarget', 'OutputDomainNameAliasHostedZoneId']);
    });

    it('lanza si el stack no tiene mapa', () => {
        assert.throws(() => mapOutputs('OtroStack', []), /Stack sin mapa de outputs: OtroStack/);
    });
});

describe('stackName', () => {
    it('antepone APPS_SERVICE_NAME al id del stack', () => {
        assert.equal(stackName('MULTITENANT', 'TenantStack'), 'MULTITENANTTenantStack');
    });
});
