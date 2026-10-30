import { webcrypto } from 'crypto';
const { subtle } = webcrypto;
import { Helper } from '../../shared';

export class EncryptionService {
    static ALGORITHM = 'AES-GCM';
    static KEY_LENGTH = 256;
    static IV_LENGTH = 12;
    static CURVE = 'P-256';

    /**
     * Encripta datos usando ECDH + AES-GCM
     * @param {string} clientPubKeyB64 - Clave pública del cliente en base64
     * @param {any} data - Datos a encriptar
     * @returns {Promise<Object>} Objeto con iv, ciphertext y serverPubKey
     */
    static async encryptForClient(clientPubKeyB64, data) {
        try {
            const clientPubKeyRaw = Buffer.from(clientPubKeyB64, 'base64');
            const clientPubKey = await subtle.importKey(
                'raw',
                clientPubKeyRaw,
                { name: 'ECDH', namedCurve: this.CURVE },
                false,
                []
            );

            const serverKeyPair = await subtle.generateKey({ name: 'ECDH', namedCurve: this.CURVE }, true, [
                'deriveKey',
            ]);

            const aesKey = await subtle.deriveKey(
                { name: 'ECDH', public: clientPubKey },
                serverKeyPair.privateKey,
                { name: this.ALGORITHM, length: this.KEY_LENGTH },
                false,
                ['encrypt']
            );

            const iv = webcrypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
            const ciphertext = await subtle.encrypt(
                { name: this.ALGORITHM, iv },
                aesKey,
                Buffer.from(JSON.stringify(data))
            );

            const serverPubKeyRaw = await subtle.exportKey('raw', serverKeyPair.publicKey);

            return {
                iv: Buffer.from(iv).toString('base64'),
                ciphertext: Buffer.from(ciphertext).toString('base64'),
                serverPubKey: Buffer.from(serverPubKeyRaw).toString('base64'),
            };
        } catch (error) {
            Helper.logError(error);
            throw new Error(`Error al encriptar: ${error.message}`);
        }
    }

    /**
     * Genera un nuevo par de claves ECDH
     * @returns {Promise<Object>} Objeto con privateKey y publicKey
     */
    static async generateKeyPair() {
        try {
            const keyPair = await subtle.generateKey({ name: 'ECDH', namedCurve: this.CURVE }, true, ['deriveKey']);

            const publicKeyRaw = await subtle.exportKey('raw', keyPair.publicKey);

            return {
                keyPair: keyPair,
                publicKeyB64: Buffer.from(publicKeyRaw).toString('base64'),
            };
        } catch (error) {
            Helper.logError(error);
            throw new Error(`Error al generar par de claves: ${error.message}`);
        }
    }

    /**
     * Desencripta datos usando ECDH + AES-GCM
     * @param {Object} encryptedData - Objeto con iv, ciphertext y serverPubKey
     * @param {CryptoKeyPair} clientKeyPair - Par de claves del cliente
     * @returns {Promise<any>} Datos desencriptados
     */
    static async decryptFromServer(encryptedData, clientKeyPair) {
        try {
            const { iv, ciphertext, serverPubKey } = encryptedData;

            const serverPubKeyRaw = Buffer.from(serverPubKey, 'base64');
            const serverPublicKey = await subtle.importKey(
                'raw',
                serverPubKeyRaw,
                { name: 'ECDH', namedCurve: this.CURVE },
                false,
                []
            );

            const aesKey = await subtle.deriveKey(
                { name: 'ECDH', public: serverPublicKey },
                clientKeyPair.privateKey,
                { name: this.ALGORITHM, length: this.KEY_LENGTH },
                false,
                ['decrypt']
            );

            const ivBuffer = Buffer.from(iv, 'base64');
            const ciphertextBuffer = Buffer.from(ciphertext, 'base64');

            const decrypted = await subtle.decrypt({ name: this.ALGORITHM, iv: ivBuffer }, aesKey, ciphertextBuffer);

            const decryptedString = new TextDecoder().decode(decrypted);
            return JSON.parse(decryptedString);
        } catch (error) {
            Helper.logError(error);
            throw new Error(`Error al desencriptar: ${error.message}`);
        }
    }
}
