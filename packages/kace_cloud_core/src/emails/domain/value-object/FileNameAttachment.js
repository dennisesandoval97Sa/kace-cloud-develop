export class Filename {
    static sanitize(value, { fallback = 'attachment', maxLength = 255 } = {}) {
        const raw = value == null ? '' : String(value);
        const basename =
            raw
                .replace(/[\u0000-\u001f\u007f]/g, '')
                .split(/[\\/]/)
                .filter(Boolean)
                .pop() ?? '';

        const sanitized = basename
            .trim()
            .replace(/^[.\s]+|[.\s]+$/g, '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[+&=% ]/g, '-')
            .replace(/[^a-zA-Z0-9.\-_]/g, '')
            .toLowerCase();

        const safe = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');
        if (!safe) {
            return fallback;
        }

        if (safe.length <= maxLength) {
            return safe;
        }

        const extension = safe.match(/(\.[a-z0-9]{1,20})$/)?.[1] ?? '';
        const baseMaxLength = Math.max(maxLength - extension.length, 1);
        return `${safe.slice(0, baseMaxLength)}${extension}`;
    }
}
