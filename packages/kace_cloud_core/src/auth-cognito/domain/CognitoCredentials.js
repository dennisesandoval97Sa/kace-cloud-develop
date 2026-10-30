import crypto, { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import PasswordEncoder from '../../shared/domain/crypto/PasswordEncoder.js';
import SecurePasswordEncoder from '../../shared/domain/crypto/SecurePasswordEncoder.js';

export class CognitoCredentials {
    constructor({
        id_token = null,
        access_token = null,
        refresh_token = null,
        expires_in = null,
        token_type = null,
        sourceIp = null,
        clientFingerprint = null,
    }) {
        this.id_token = id_token;
        this.access_token = access_token;
        this.refresh_token = refresh_token;
        this.expires_in = expires_in;
        this.token_type = token_type;
        this.sourceIp = sourceIp;
        this.clientFingerprint = clientFingerprint;
        this.decodeToken = jwt.decode(this.id_token);
        this.hashSessionId = this.#generateSessionFingerprint(
            `${this.decodeToken.email}:${this.decodeToken?.sub}:${this.clientFingerprint}`
        );
        this.hashCognitoResponse = PasswordEncoder.generateHash(
            JSON.stringify({
                id_token: this.id_token,
                access_token: this.access_token,
                refresh_token: this.refresh_token,
                expires_in: this.expires_in,
                token_type: this.token_type,
            })
        );
        this.session_key = PasswordEncoder.generateHash(
            `${this.clientFingerprint}${this.hashSessionId}${randomBytes(32).toString('hex')}`
        );
        Object.freeze(this);
    }

    /**
     * Genera una huella digital única del dispositivo/navegador
     */
    #generateSessionFingerprint(fingerprintData) {
        return SecurePasswordEncoder.createHash(fingerprintData);
    }
}
