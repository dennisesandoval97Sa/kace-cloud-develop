import { spawn } from 'node:child_process';
import { CommandError } from './errors.mjs';

export function runCommand(cmd, args = [], { cwd, env, stream = false } = {}) {
    return new Promise((resolve) => {
        const child = spawn(cmd, args, {
            cwd,
            env,
            stdio: stream ? ['ignore', 'inherit', 'inherit'] : ['ignore', 'pipe', 'pipe'],
        });
        let stdoutText = '';
        let stderrText = '';
        child.stdout?.on('data', (chunk) => {
            stdoutText += chunk;
        });
        child.stderr?.on('data', (chunk) => {
            stderrText += chunk;
        });
        child.on('error', (error) => {
            resolve({ code: 1, stdout: stdoutText, stderr: `${error.code || ''} ${error.message}`.trim() });
        });
        child.on('close', (code) => {
            resolve({ code: code ?? 1, stdout: stdoutText, stderr: stderrText });
        });
    });
}

export async function awsJson(ctx, args, { region = ctx.region } = {}) {
    const result = await ctx.run('aws', ['--no-cli-pager', ...args, '--region', region, '--output', 'json']);
    if (result.code !== 0) {
        const detail = (result.stderr || result.stdout || '').trim();
        throw new CommandError(`aws ${args.slice(0, 2).join(' ')} falló: ${detail}`, result);
    }
    const text = (result.stdout || '').trim();
    return text ? JSON.parse(text) : {};
}

export async function runStreamed(ctx, cmd, args, label) {
    const result = await ctx.run(cmd, args, { stream: true });
    if (result.code !== 0) {
        throw new CommandError(`${label} terminó con código ${result.code}`, result);
    }
}

export function isStackMissing(error) {
    return /does not exist/.test(error?.result?.stderr || '');
}
