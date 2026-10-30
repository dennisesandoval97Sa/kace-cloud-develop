export class SecretReferenceExtractor {
    static extract(dto) {
        const references = new Set();
        const regex = /\bSECRET_([A-Z0-9_]+)/g;

        const extractFromString = (value) => {
            let match;
            while ((match = regex.exec(value)) !== null) {
                references.add(match[1]);
            }
        };

        const extractRecursively = (obj) => {
            if (!obj) return;

            if (typeof obj === 'string') {
                extractFromString(obj);
                return;
            }

            if (Array.isArray(obj)) {
                obj.forEach(extractRecursively);
                return;
            }

            if (typeof obj === 'object') {
                Object.values(obj).forEach(extractRecursively);
            }
        };

        if (dto.url) {
            extractFromString(dto.url);
        }

        if (Boolean(dto.is_dynamic_header) && dto.headers?.headers) {
            Object.values(dto.headers.headers).forEach((value) => {
                if (typeof value === 'string') {
                    extractFromString(value);
                }
            });
        }

        if (Boolean(dto.is_dynamic_body) && dto.body?.body) {
            extractRecursively(dto.body.body);
        }

        return Array.from(references);
    }
}
