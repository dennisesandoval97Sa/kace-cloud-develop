import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

export const AUTO_BLOCK_HEADER = '# --- deploy-env (auto) ---';

const LINE_RE = /^(\s*)(export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

function isComment(line) {
    return /^\s*#/.test(line);
}

function splitValue(raw) {
    const trimmed = raw.trim();
    const quoted = trimmed.match(/^(['"])(.*?)\1(\s+#.*)?$/);
    if (quoted) {
        return { value: quoted[2], quote: quoted[1], comment: quoted[3] || '' };
    }
    const plain = trimmed.match(/^(.*?)(\s+#.*)?$/);
    return { value: plain[1], quote: '', comment: plain[2] || '' };
}

export function parseEnv(text) {
    const env = {};
    for (const line of text.split(/\r?\n/)) {
        if (isComment(line)) {
            continue;
        }
        const match = line.match(LINE_RE);
        if (match) {
            env[match[3]] = splitValue(match[4]).value;
        }
    }
    return env;
}

export function planEnvUpdates(text, updates) {
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text.split(/\r?\n/);
    const lastIndex = {};
    lines.forEach((line, index) => {
        const match = !isComment(line) && line.match(LINE_RE);
        if (match) {
            lastIndex[match[3]] = index;
        }
    });

    const changes = [];
    const appended = [];
    for (const [key, after] of Object.entries(updates)) {
        const index = lastIndex[key];
        if (index === undefined) {
            appended.push(`${key}=${after}`);
            changes.push({ key, status: 'NUEVA', before: '', after });
            continue;
        }
        const match = lines[index].match(LINE_RE);
        const current = splitValue(match[4]);
        if (current.value === after) {
            changes.push({ key, status: 'IGUAL', before: after, after });
            continue;
        }
        lines[index] = `${match[1]}${match[2] || ''}${key}=${current.quote}${after}${current.quote}${current.comment}`;
        changes.push({ key, status: current.value === '' ? 'NUEVA' : 'CAMBIA', before: current.value, after });
    }

    if (appended.length) {
        while (lines.length && lines[lines.length - 1] === '') {
            lines.pop();
        }
        if (!lines.includes(AUTO_BLOCK_HEADER)) {
            lines.push('', AUTO_BLOCK_HEADER);
        }
        lines.push(...appended, '');
    }

    return { text: lines.join(eol), changes };
}

export function timestamp(date) {
    const pad = (value) => String(value).padStart(2, '0');
    return (
        `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
        `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
    );
}

export function writeEnvUpdates(filePath, updates, { dryRun, backupState, now }) {
    const original = readFileSync(filePath, 'utf8');
    const { text, changes } = planEnvUpdates(original, updates);
    const changed = changes.some((change) => change.status !== 'IGUAL');
    if (dryRun || !changed) {
        return changes;
    }
    if (!backupState.done) {
        backupState.path = `${filePath}.bak-${timestamp(now)}`;
        copyFileSync(filePath, backupState.path);
        backupState.done = true;
    }
    writeFileSync(filePath, text);
    return changes;
}

export function maskValue(value) {
    if (!value) {
        return '(vacía)';
    }
    if (value.length <= 8) {
        return '****';
    }
    return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function formatChanges(changes) {
    const visible = changes.filter((change) => change.status !== 'IGUAL');
    if (!visible.length) {
        return [`  .env al día (${changes.length} clave(s) sin cambios)`];
    }
    return visible.map((change) =>
        change.status === 'NUEVA'
            ? `  NUEVA   ${change.key} = ${maskValue(change.after)}`
            : `  CAMBIA  ${change.key}: ${maskValue(change.before)} → ${maskValue(change.after)}  (¿el .env apuntaba a otra cuenta?)`
    );
}
