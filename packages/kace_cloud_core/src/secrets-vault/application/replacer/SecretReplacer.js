import { SecretsFinderByReferences } from '../../domain/SecretsFinderByReferences';
import { Helper } from '../../../shared';

export class SecretReplacer {
    constructor(secretRepository) {
        this.finderByReferences = new SecretsFinderByReferences(secretRepository);
    }

    async replaceSecretsInBody(body) {
        if (!body) return body;

        const bodyText = JSON.stringify(body);
        const newBody = await this.#replaceSecrets(bodyText);
        return JSON.parse(newBody);
    }

    async replaceSecretsInUrl(url) {
        if (!url) return url;

        return this.#replaceSecrets(url);
    }

    async replaceSecretsInHeader(header) {
        if (!header) return header;

        const headerText = JSON.stringify(header);

        const newHeader = await this.#replaceSecrets(headerText);

        return JSON.parse(newHeader);
    }

    async replaceSecretsInValue(value) {
        if (!value) return value;

        return this.#replaceSecrets(value);
    }

    async #replaceSecrets(text) {
        if (typeof text !== 'string') {
            throw new Error('SecretReplacer: El texto a reemplazar debe ser una cadena válida.');
        }

        const secretRegex = /SECRET_[A-Z0-9_-]+/g;
        const matches = [...text.matchAll(secretRegex)];
        if (matches.length === 0) return text;

        // Dedup: si SECRET_X aparece N veces, fetchamos 1 vez.
        const uniqueKeys = [...new Set(matches.map((m) => m[0]))];
        const references = uniqueKeys.map((k) => k.replace('SECRET_', ''));

        const secrets = await this.finderByReferences.execute(references);

        const valueByKey = new Map();
        for (const secret of secrets) {
            valueByKey.set(`SECRET_${secret.referencia.value}`, secret.decryptSecret());
        }

        // Single-pass replace: cubre TODAS las ocurrencias y no replica el valor
        // desencriptado si por casualidad contuviera otra substring "SECRET_X".
        return text.replace(secretRegex, (match) => {
            const value = valueByKey.get(match);
            if (value === undefined) {
                Helper.logError(
                    `SecretReplacer: secret reference "${match.replace('SECRET_', '')}" not found in vault, keeping original key`
                );
                return match;
            }
            return value;
        });
    }
}
