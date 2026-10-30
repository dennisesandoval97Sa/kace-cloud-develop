export class BetweenParser {
    static parse(value) {
        if (Array.isArray(value)) return value;

        if (typeof value === 'string') {
            return value
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean);
        }

        return [];
    }
}
