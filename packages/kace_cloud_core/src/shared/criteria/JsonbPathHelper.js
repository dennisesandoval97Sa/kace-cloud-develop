export class JsonbPathHelper {
    static jsonExtract(entity, field) {
        if (!entity) {
            throw new Error('Entity is required for jsonExtract');
        }

        const parts = field.split('.').filter(Boolean);

        if (parts.length > 0 && parts[0] === entity) {
            parts.shift();
        }

        if (parts.length === 0) {
            throw new Error(`Invalid JSON field: ${field}`);
        }

        let expr = `${entity}.data`;

        if (parts.length === 1) {
            return `${expr} ->> '${parts[0]}'`;
        }

        const last = parts.pop();

        for (const part of parts) {
            expr += ` -> '${part}'`;
        }

        return `${expr} ->> '${last}'`;
    }
}
