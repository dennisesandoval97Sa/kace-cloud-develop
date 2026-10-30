import { stdin, stderr } from 'node:process';

const ESC = '\x1b';
const COLOR =
    process.env.NO_COLOR || !stderr.isTTY
        ? {
              reset: '',
              bold: '',
              dim: '',
              italic: '',
              inverse: '',
              cyan: '',
              green: '',
              yellow: '',
              red: '',
              magenta: '',
              white: '',
              gray: '',
              bg: '',
          }
        : {
              reset: `${ESC}[0m`,
              bold: `${ESC}[1m`,
              dim: `${ESC}[2m`,
              italic: `${ESC}[3m`,
              inverse: `${ESC}[7m`,
              cyan: `${ESC}[36m`,
              green: `${ESC}[32m`,
              yellow: `${ESC}[33m`,
              red: `${ESC}[31m`,
              magenta: `${ESC}[35m`,
              white: `${ESC}[37m`,
              gray: `${ESC}[90m`,
              bg: `${ESC}[44m`,
          };

export const ui = COLOR;

export function visibleLength(text) {
    return String(text)
        .replace(/\x1b\[[0-9;]*m/g, '')
        .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').length;
}

export function termSize(stream = stderr) {
    return {
        columns: Math.max(40, stream.columns || 80),
        rows: Math.max(12, stream.rows || 24),
    };
}

export function truncate(text, width) {
    const value = String(text);
    if (visibleLength(value) <= width) {
        return value;
    }
    const raw = value.replace(/\x1b\[[0-9;]*m/g, '');
    if (raw.length <= width) {
        return value;
    }
    if (width <= 1) {
        return '…';
    }
    return `${raw.slice(0, Math.max(1, width - 1))}…`;
}

export function padVisible(text, width) {
    const extra = width - visibleLength(text);
    if (extra <= 0) {
        return truncate(text, width);
    }
    return `${text}${' '.repeat(extra)}`;
}

export function paint(style, text) {
    return `${style}${text}${COLOR.reset}`;
}

function cancelled() {
    const error = new Error('Cancelado.');
    error.code = 'CANCELLED';
    return error;
}

function parseKey(chunk) {
    const s = String(chunk);
    if (s === '\u0003') {
        return { type: 'ctrl+c' };
    }
    if (s === '\r' || s === '\n') {
        return { type: 'enter' };
    }
    if (s === ' ') {
        return { type: 'space' };
    }
    if (s === '\x7f' || s === '\b') {
        return { type: 'backspace' };
    }
    if (s === '\x1b') {
        return { type: 'escape' };
    }
    if (s === '\x1b[A' || s === '\x1bOA') {
        return { type: 'up' };
    }
    if (s === '\x1b[B' || s === '\x1bOB') {
        return { type: 'down' };
    }
    if (s === '\x1b[C' || s === '\x1bOC') {
        return { type: 'right' };
    }
    if (s === '\x1b[D' || s === '\x1bOD') {
        return { type: 'left' };
    }
    if (s === '\x1b[5~') {
        return { type: 'pageup' };
    }
    if (s === '\x1b[6~') {
        return { type: 'pagedown' };
    }
    if (s === '\t') {
        return { type: 'tab' };
    }
    return { type: 'char', value: s };
}

function readKey(input = stdin) {
    return new Promise((resolve, reject) => {
        const onData = (chunk) => {
            cleanup();
            resolve(parseKey(chunk));
        };
        const onEnd = () => {
            cleanup();
            reject(cancelled());
        };
        const onError = (error) => {
            if (error?.code === 'EAGAIN' || error?.code === 'EWOULDBLOCK') {
                return;
            }
            cleanup();
            reject(error);
        };
        const cleanup = () => {
            input.off('data', onData);
            input.off('end', onEnd);
            input.off('error', onError);
        };
        input.on('data', onData);
        input.on('end', onEnd);
        input.on('error', onError);
    });
}

export function restoreTty(input = stdin) {
    for (const stream of new Set([input, stdin])) {
        try {
            if (stream?.isTTY && typeof stream.setRawMode === 'function') {
                stream.setRawMode(false);
            }
        } catch {
            // The next process still needs a cooked TTY even if this one already left raw mode.
        }
        try {
            stream?.pause();
        } catch {
            // ignore
        }
    }
}

export function finishCli(code = 0) {
    restoreTty(stdin);
    process.exit(code);
}

if (!restoreTty.hooked) {
    restoreTty.hooked = true;
    process.once('exit', () => {
        restoreTty();
    });
}

async function withRawInput(input, fn) {
    if (input.isTTY && typeof input.setRawMode === 'function') {
        input.setRawMode(true);
    }
    input.resume();
    try {
        return await fn();
    } finally {
        restoreTty(input);
    }
}

export async function readPipedStdin(input = stdin) {
    const chunks = [];
    input.resume();
    try {
        for await (const chunk of input) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
    } finally {
        try {
            input.pause();
        } catch {
            // ignore
        }
    }
    return chunks.length ? Buffer.concat(chunks).toString('utf8') : '';
}

function rewriteBlock(write, previousCount, lines) {
    if (previousCount > 0) {
        write(`${ESC}[${previousCount}A`);
    }
    for (const line of lines) {
        write(`${ESC}[2K${ESC}[1G${line}\n`);
    }
    if (previousCount > lines.length) {
        const extra = previousCount - lines.length;
        for (let index = 0; index < extra; index += 1) {
            write(`${ESC}[2K\n`);
        }
        write(`${ESC}[${extra}A`);
    }
    return lines.length;
}

function doneLine(message, answer) {
    return `${paint(COLOR.green, '◇')}  ${paint(COLOR.bold, message)}  ${paint(COLOR.cyan, answer)}`;
}

export function writeBanner(write = (text) => stderr.write(text), { title, subtitle, hint } = {}) {
    const { columns } = termSize();
    const width = Math.min(columns, 88);
    const bar = paint(COLOR.dim, '─'.repeat(Math.max(20, width - 2)));
    write('\n');
    write(`  ${paint(COLOR.bold + COLOR.cyan, title || 'KACE Cloud')}${paint(COLOR.dim, '  ·  deploy:concurrency')}\n`);
    if (subtitle) {
        write(`  ${paint(COLOR.dim, subtitle)}\n`);
    }
    write(`  ${bar}\n`);
    write(`  ${paint(COLOR.dim, hint || '↑↓ navega   espacio marca   enter sigue   escribe filtra   ctrl+c sale')}\n`);
    write('\n');
}

function filterOptions(options, query) {
    const needle = query.trim().toLowerCase();
    if (!needle) {
        return options.map((option, index) => ({ option, index }));
    }
    return options
        .map((option, index) => ({ option, index }))
        .filter(({ option }) => `${option.label} ${option.value}`.toLowerCase().includes(needle));
}

function windowed(items, cursor, maxVisible) {
    if (items.length <= maxVisible) {
        return { start: 0, view: items };
    }
    let start = Math.max(0, cursor - Math.floor(maxVisible / 2));
    if (start + maxVisible > items.length) {
        start = items.length - maxVisible;
    }
    return { start, view: items.slice(start, start + maxVisible) };
}

export async function promptSelect({
    message,
    hint,
    options,
    default: defaultValue,
    multiple = false,
    write = (text) => stderr.write(text),
    input = stdin,
}) {
    if (!options?.length) {
        throw new Error('No hay opciones para elegir.');
    }
    const selected = new Set();
    if (multiple && Array.isArray(defaultValue)) {
        for (const value of defaultValue) {
            selected.add(value);
        }
    }
    let cursor = Math.max(
        0,
        options.findIndex((option) => option.value === (multiple ? defaultValue?.[0] : defaultValue))
    );
    if (cursor < 0) {
        cursor = 0;
    }
    let query = '';
    let painted = 0;
    const { columns, rows } = termSize();
    const maxVisible = Math.max(5, Math.min(14, rows - 10));

    const paintFrame = () => {
        const filtered = filterOptions(options, query);
        if (filtered.length === 0) {
            cursor = 0;
        } else if (cursor >= filtered.length) {
            cursor = filtered.length - 1;
        }
        const { start, view } = windowed(filtered, cursor, maxVisible);
        const width = Math.min(columns - 4, 92);
        const activeOption = filtered[cursor]?.option;
        const liveHint =
            activeOption?.description ||
            hint ||
            (multiple ? 'espacio marca varias · enter confirma' : 'enter elige · escribe para filtrar');
        const lines = [
            `${paint(COLOR.cyan + COLOR.bold, '◆')}  ${paint(COLOR.bold, message)}`,
            `${paint(COLOR.dim, '│')}  ${paint(COLOR.italic + COLOR.white, truncate(liveHint, width - 4))}`,
        ];
        if (query) {
            lines.push(`${paint(COLOR.dim, '│')}  ${paint(COLOR.yellow, `filtro · ${query}█`)}`);
        }
        if (view.length === 0) {
            lines.push(
                `${paint(COLOR.dim, '│')}  ${paint(COLOR.yellow, 'Sin coincidencias. Borra el filtro o escribe otra cosa.')}`
            );
        }
        view.forEach((entry, offset) => {
            const absolute = start + offset;
            const active = absolute === cursor;
            const marked = multiple ? selected.has(entry.option.value) : active;
            const pointer = active ? paint(COLOR.cyan, '❯') : ' ';
            const mark = multiple
                ? marked
                    ? paint(COLOR.green, '◼')
                    : paint(COLOR.dim, '◻')
                : marked
                  ? paint(COLOR.cyan, '●')
                  : paint(COLOR.dim, '○');
            const badge = entry.option.hint ? `  ${paint(COLOR.dim, entry.option.hint)}` : '';
            const label = truncate(entry.option.label, width - 10);
            const text = active ? paint(COLOR.bold + COLOR.white, label) : paint(COLOR.white, label);
            lines.push(`  ${pointer} ${mark}  ${text}${badge}`);
        });
        if (filtered.length > maxVisible) {
            lines.push(
                `${paint(COLOR.dim, '│')}  ${paint(COLOR.dim, `${start + 1}–${start + view.length} de ${filtered.length}`)}`
            );
        }
        if (multiple) {
            lines.push(
                `${paint(COLOR.dim, '│')}  ${paint(COLOR.cyan, `${selected.size} seleccionado${selected.size === 1 ? '' : 's'}`)}`
            );
        }
        lines.push(`${paint(COLOR.dim, '└')}  ${paint(COLOR.dim, '↑↓  espacio  enter  ctrl+c')}`);
        painted = rewriteBlock(write, painted, lines);
    };

    return withRawInput(input, async () => {
        paintFrame();
        while (true) {
            const key = await readKey(input);
            const filtered = filterOptions(options, query);
            if (key.type === 'ctrl+c' || key.type === 'escape') {
                write('\n');
                throw cancelled();
            }
            if (key.type === 'up') {
                cursor = filtered.length ? (cursor - 1 + filtered.length) % filtered.length : 0;
            } else if (key.type === 'down' || key.type === 'tab') {
                cursor = filtered.length ? (cursor + 1) % filtered.length : 0;
            } else if (key.type === 'pageup') {
                cursor = Math.max(0, cursor - maxVisible);
            } else if (key.type === 'pagedown') {
                cursor = Math.min(filtered.length - 1, cursor + maxVisible);
            } else if (key.type === 'space' && multiple && filtered[cursor]) {
                const value = filtered[cursor].option.value;
                if (selected.has(value)) {
                    selected.delete(value);
                } else {
                    selected.add(value);
                }
            } else if (key.type === 'backspace') {
                query = query.slice(0, -1);
                cursor = 0;
            } else if (key.type === 'char' && key.value && !key.value.startsWith(ESC)) {
                query += key.value;
                cursor = 0;
            } else if (key.type === 'enter') {
                if (multiple) {
                    const values = options.filter((option) => selected.has(option.value)).map((option) => option.value);
                    rewriteBlock(write, painted, [
                        doneLine(message, `${values.length} elegido${values.length === 1 ? '' : 's'}`),
                    ]);
                    write('\n');
                    return values;
                }
                const chosen = filtered[cursor]?.option || options[0];
                rewriteBlock(write, painted, [doneLine(message, chosen.label)]);
                write('\n');
                return chosen.value;
            }
            paintFrame();
        }
    });
}

export async function promptConfirm({
    message,
    hint = '←→ o ↑↓ · enter confirma',
    default: defaultValue = true,
    write = (text) => stderr.write(text),
    input = stdin,
}) {
    let yes = defaultValue !== false;
    let painted = 0;
    const paintFrame = () => {
        const yesLabel = yes ? paint(COLOR.inverse + COLOR.green, '  Sí  ') : paint(COLOR.dim, '  Sí  ');
        const noLabel = yes ? paint(COLOR.dim, '  No  ') : paint(COLOR.inverse + COLOR.red, '  No  ');
        painted = rewriteBlock(write, painted, [
            `${paint(COLOR.cyan + COLOR.bold, '◆')}  ${paint(COLOR.bold, message)}`,
            `${paint(COLOR.dim, '│')}  ${yesLabel}    ${noLabel}`,
            `${paint(COLOR.dim, '└')}  ${paint(COLOR.dim, hint)}`,
        ]);
    };
    return withRawInput(input, async () => {
        paintFrame();
        while (true) {
            const key = await readKey(input);
            if (key.type === 'ctrl+c' || key.type === 'escape') {
                write('\n');
                throw cancelled();
            }
            if (
                key.type === 'left' ||
                key.type === 'right' ||
                key.type === 'up' ||
                key.type === 'down' ||
                key.type === 'tab'
            ) {
                yes = !yes;
            } else if (
                key.type === 'char' &&
                (key.value === 's' || key.value === 'y' || key.value === 'S' || key.value === 'Y')
            ) {
                yes = true;
            } else if (key.type === 'char' && (key.value === 'n' || key.value === 'N')) {
                yes = false;
            } else if (key.type === 'enter') {
                rewriteBlock(write, painted, [doneLine(message, yes ? 'sí' : 'no')]);
                write('\n');
                return yes;
            }
            paintFrame();
        }
    });
}

export async function promptInput({
    message,
    hint,
    default: defaultValue = '',
    validate,
    write = (text) => stderr.write(text),
    input = stdin,
}) {
    let value = '';
    let painted = 0;
    let error = '';
    const paintFrame = () => {
        const shown = value || (defaultValue ? paint(COLOR.dim, String(defaultValue)) : paint(COLOR.dim, '…'));
        const lines = [
            `${paint(COLOR.cyan + COLOR.bold, '◆')}  ${paint(COLOR.bold, message)}`,
            `${paint(COLOR.dim, '│')}  ${shown}${paint(COLOR.cyan, '█')}`,
        ];
        if (hint) {
            lines.push(`${paint(COLOR.dim, '│')}  ${paint(COLOR.dim, hint)}`);
        }
        if (error) {
            lines.push(`${paint(COLOR.dim, '│')}  ${paint(COLOR.red, error)}`);
        }
        lines.push(`${paint(COLOR.dim, '└')}  ${paint(COLOR.dim, 'enter confirma · esc cancela')}`);
        painted = rewriteBlock(write, painted, lines);
    };
    return withRawInput(input, async () => {
        paintFrame();
        while (true) {
            const key = await readKey(input);
            if (key.type === 'ctrl+c' || key.type === 'escape') {
                write('\n');
                throw cancelled();
            }
            if (key.type === 'backspace') {
                value = value.slice(0, -1);
                error = '';
            } else if (key.type === 'char' && key.value && !key.value.startsWith(ESC)) {
                value += key.value;
                error = '';
            } else if (key.type === 'enter') {
                const next = value.trim() || String(defaultValue ?? '');
                if (validate) {
                    const problem = validate(next);
                    if (problem) {
                        error = problem;
                        paintFrame();
                        continue;
                    }
                }
                rewriteBlock(write, painted, [doneLine(message, next)]);
                write('\n');
                return next;
            }
            paintFrame();
        }
    });
}

export function writePanel(write, { title, rows, tone = 'info' }) {
    const { columns } = termSize();
    const width = Math.min(columns - 2, 88);
    const accent =
        tone === 'warn' ? COLOR.yellow : tone === 'error' ? COLOR.red : tone === 'ok' ? COLOR.green : COLOR.cyan;
    write(`\n  ${paint(accent + COLOR.bold, title)}\n`);
    write(`  ${paint(COLOR.dim, '─'.repeat(Math.max(16, width - 4)))}\n`);
    for (const [label, value] of rows) {
        write(`  ${paint(COLOR.dim, padVisible(label, 14))}  ${paint(COLOR.bold + COLOR.white, value)}\n`);
    }
    write('\n');
}

export function createInteractiveAsk({ write = (text) => stderr.write(text), input = stdin } = {}) {
    return async (question) => {
        const hint = question.hint;
        if (question.type === 'multiselect') {
            return promptSelect({
                message: question.message,
                hint: hint || 'espacio marca · enter confirma · escribe filtra',
                options: question.options,
                default: question.default,
                multiple: true,
                write,
                input,
            });
        }
        if (question.type === 'select' || question.type === 'search-select') {
            return promptSelect({
                message: question.message,
                hint: hint || (question.options.length > 8 ? 'escribe para filtrar · enter elige' : '↑↓ y enter'),
                options: question.options,
                default: question.default,
                write,
                input,
            });
        }
        if (question.type === 'confirm') {
            const yes = await promptConfirm({
                message: question.message,
                hint,
                default: question.default !== 'no' && question.default !== false,
                write,
                input,
            });
            if (question.options) {
                return yes ? question.options[0].value : question.options[1]?.value;
            }
            return yes;
        }
        return promptInput({
            message: question.message,
            hint:
                hint ||
                (question.id === 'concurrency' ? 'cuántos paquetes a la vez · enter usa el valor sugerido' : ''),
            default: question.default,
            validate:
                question.id === 'concurrency'
                    ? (value) => {
                          const concurrency = Number(value);
                          if (!Number.isInteger(concurrency) || concurrency < 1) {
                              return 'La concurrencia debe ser un entero positivo.';
                          }
                          return '';
                      }
                    : undefined,
            write,
            input,
        });
    };
}

export function hudLineCount(width) {
    return width < 68 ? 6 : 12;
}

export function beginBottomHud(stream = stderr) {
    const { columns, rows } = termSize(stream);
    const height = hudLineCount(columns);
    const scrollEnd = Math.max(3, rows - height);
    stream.write(`${ESC}[?25l`);
    stream.write(`${ESC}[1;${scrollEnd}r`);
    stream.write(`${ESC}[${scrollEnd};1H\n`);
    return { columns, rows, height, scrollEnd };
}

export function paintBottomHud(stream, block) {
    const { columns, rows } = termSize(stream);
    const lines = String(block).split('\n');
    const height = lines.length;
    const startRow = Math.max(1, rows - height + 1);
    let output = `${ESC}[${startRow};1H`;
    for (const line of lines) {
        output += `${ESC}[2K${padVisible(line, columns)}\n`;
    }
    stream.write(output);
}

export function endBottomHud(stream = stderr) {
    stream.write(`${ESC}[r`);
    stream.write(`${ESC}[?25h`);
    const { rows } = termSize(stream);
    stream.write(`${ESC}[${rows};1H\n`);
}

export { parseKey };
