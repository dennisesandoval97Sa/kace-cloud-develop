import { Buffer } from 'buffer';
import { createCipheriv, createDecipheriv } from 'node:crypto';
import { Helper } from "../../infrastructure/utils/Helper.js";

export class Crypto {
    static ENCRYPTION_METHOD = 'aes-256-gcm';
    static LEGACY_ENCRYPTION_METHOD = 'aes-256-cbc';
    /** is initialized in the constructor*/
    #secret_iv;
    /** is initialized in the constructor*/
    #secret_key;
    /** is initialized in the constructor*/
    #encryption_method;

    constructor(secret_iv, secret_key, encryption_method) {
        this.#secret_iv = secret_iv;
        this.#secret_key = secret_key;
        this.#encryption_method = encryption_method;
        if (!this.#secret_iv || !this.#secret_key || !this.#encryption_method) {
            Helper.logError('Crypto::constructor secret_iv, secret_key and encryption_method are required');
            throw new Error('secret_iv, secret_key and encryption_method are required');
        }

        try {
            const iv = Buffer.from(this.#secret_iv, 'base64');
            const key = Buffer.from(this.#secret_key, 'base64');

            if (iv.length !== 16) {
                throw new Error(`Invalid IV length: expected 16 bytes, got ${iv.length}`);
            }
        } catch (error) {
            Helper.logError(`Invalid crypto params: ${error.message}`);
            throw new Error(`Invalid crypto params: ${error.message}`);
        }
    }

    encryptData(data) {
        const iv = Buffer.from(this.#secret_iv, 'base64');
        const key = Buffer.from(this.#secret_key, 'base64');

        if (this.#encryption_method.toLowerCase() === Crypto.ENCRYPTION_METHOD) {
            const cipher = createCipheriv(this.#encryption_method, key, iv);

            let encrypted = cipher.update(data, 'utf-8', 'base64');
            encrypted += cipher.final('base64');
            const authTag = cipher.getAuthTag().toString('base64');

            return `${iv.toString('base64')}:${authTag}:${encrypted}`;
        }

        if (this.#encryption_method.toLowerCase() === Crypto.LEGACY_ENCRYPTION_METHOD) {
            const cipher = createCipheriv(this.#encryption_method, key, iv);
            let encrypted = cipher.update(data, 'utf-8', 'base64');
            encrypted += cipher.final('base64');
            return encrypted;
        }
    }

    decryptData(encryptedData) {
        const parts = encryptedData.split(':');
        const key = Buffer.from(this.#secret_key, 'base64');

        if (parts.length === 3) {
            try {
                const iv = Buffer.from(parts[0], 'base64');
                const authTag = Buffer.from(parts[1], 'base64');
                const encryptedText = parts[2];

                const decipher = createDecipheriv(Crypto.ENCRYPTION_METHOD, key, iv);
                decipher.setAuthTag(authTag);

                let decrypted = decipher.update(encryptedText, 'base64', 'utf-8');
                decrypted += decipher.final('utf-8');
                return decrypted;
            } catch (error) {
                Helper.logError(`GCM Decryption failed: ${error.message}`);
                throw error;
            }
        }

        try {
            const iv = Buffer.from(this.#secret_iv, 'base64');

            const decipher = createDecipheriv(Crypto.LEGACY_ENCRYPTION_METHOD, key, iv);
            let decrypted = decipher.update(encryptedData, 'base64', 'utf-8');
            decrypted += decipher.final('utf-8');
            return decrypted;
        } catch (error) {
            Helper.logError(`Legacy Decryption failed: ${error.message}`);
            throw error;
        }
    }
}
