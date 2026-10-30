export default function flattenExternalCodes(cell) {
    if (cell == null) return '';

    if (typeof cell === 'string') {
        try {
            const parsed = JSON.parse(cell);
            if (Array.isArray(parsed)) {
                return parsed.map(String).join(',');
            }
            if (parsed && typeof parsed === 'object') {
                return Object.keys(parsed)
                    .sort((a, b) => a.localeCompare(b))
                    .join(',');
            }
            return String(cell);
        } catch {
            return cell;
        }
    }
    if (Array.isArray(cell)) {
        return cell.map(String).join(',');
    }
    if (typeof cell === 'object') {
        return Object.keys(cell)
            .sort((a, b) => a.localeCompare(b))
            .join(',');
    }
    return String(cell);
}
export function toExternalCodesObject(input) {
    if (input === null) return null;
    if (input === undefined) return undefined;

    if (typeof input === 'object' && !Array.isArray(input)) return input;

    if (typeof input !== 'string') return undefined;
    const raw = input.trim();
    if (raw === '') return undefined;

    if (raw.startsWith('{') && raw.endsWith('}')) {
        try {
            const obj = JSON.parse(raw);
            return obj && typeof obj === 'object' ? obj : undefined;
        } catch {}
    }

    const tokens = raw
        .split(/[,\n;]+/)
        .map((t) => t.trim().replace(/(^["'])|(["']$)/g, ''))
        .filter(Boolean);

    if (tokens.length === 0) return undefined;

    const out = {};
    for (const code of tokens) out[code] = code;
    return out;
}
