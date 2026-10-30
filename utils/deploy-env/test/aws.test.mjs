import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { awsJson, isStackMissing, runCommand, runStreamed } from '../aws.mjs';
import { CommandError } from '../errors.mjs';
import { createFakeRun } from './helpers.mjs';

describe('awsJson', () => {
    it('añade --no-cli-pager, --region y --output json y parsea la salida', async () => {
        // Arrange
        const fake = createFakeRun([{ match: 'describe-stacks', result: { stdout: '{"Stacks":[]}' } }]);
        const ctx = { region: 'us-east-1', run: fake.run };

        // Act
        const data = await awsJson(ctx, ['cloudformation', 'describe-stacks', '--stack-name', 'X']);

        // Assert
        assert.deepEqual(data, { Stacks: [] });
        assert.deepEqual(fake.calls[0].args, [
            '--no-cli-pager',
            'cloudformation',
            'describe-stacks',
            '--stack-name',
            'X',
            '--region',
            'us-east-1',
            '--output',
            'json',
        ]);
    });

    it('usa la región explícita cuando se pasa', async () => {
        // Arrange
        const fake = createFakeRun();
        const ctx = { region: 'us-east-1', run: fake.run };

        // Act
        await awsJson(ctx, ['sts', 'get-caller-identity'], { region: 'eu-west-1' });

        // Assert
        assert.ok(fake.calls[0].line.includes('--region eu-west-1'));
    });

    it('devuelve {} con stdout vacío', async () => {
        // Arrange
        const ctx = { region: 'us-east-1', run: createFakeRun().run };

        // Act
        const data = await awsJson(ctx, ['cognito-idp', 'update-user-pool-client']);

        // Assert
        assert.deepEqual(data, {});
    });

    it('lanza CommandError con el stderr cuando el código no es 0', async () => {
        // Arrange
        const fake = createFakeRun([
            { match: 'describe-stacks', result: { code: 254, stderr: 'Stack X does not exist' } },
        ]);
        const ctx = { region: 'us-east-1', run: fake.run };

        // Act
        const promise = awsJson(ctx, ['cloudformation', 'describe-stacks']);

        // Assert
        await assert.rejects(promise, (error) => {
            assert.ok(error instanceof CommandError);
            assert.match(error.message, /does not exist/);
            assert.equal(isStackMissing(error), true);
            return true;
        });
    });
});

describe('runStreamed', () => {
    it('pide stream y lanza CommandError si el proceso falla', async () => {
        // Arrange
        const fake = createFakeRun([{ match: 'pnpm install', result: { code: 1 } }]);
        const ctx = { run: fake.run };

        // Act
        const promise = runStreamed(ctx, 'pnpm', ['install'], 'pnpm install');

        // Assert
        await assert.rejects(promise, /pnpm install terminó con código 1/);
        assert.equal(fake.calls[0].opts.stream, true);
    });
});

describe('runCommand', () => {
    it('captura stdout, stderr y el código de un proceso real', async () => {
        // Arrange
        const script = 'process.stdout.write("hola"); process.stderr.write("aviso"); process.exit(3);';

        // Act
        const result = await runCommand(process.execPath, ['-e', script], { env: process.env });

        // Assert
        assert.deepEqual(result, { code: 3, stdout: 'hola', stderr: 'aviso' });
    });

    it('devuelve code 1 si el binario no existe', async () => {
        // Act
        const result = await runCommand('binario-que-no-existe-deploy-env', [], { env: process.env });

        // Assert
        assert.equal(result.code, 1);
        assert.match(result.stderr, /ENOENT/);
    });
});
