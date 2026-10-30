export class KeyService {
    static instance = null;
    static _initPromise = null;
    keyPair = undefined;

    constructor () {}

    static async getInstance () {
        if (this.instance) return this.instance;

        if (this._initPromise) return this._initPromise;

        this._initPromise = (async () => {
            const inst = new KeyService();
            await inst.generateKeyPair();
            this.instance = inst;
            this._initPromise = null;
            return inst;
        })();

        return this._initPromise;
    }

    async generateKeyPair () {
        this.keyPair = await window.crypto.subtle.generateKey(
            {
                name: "ECDH",
                namedCurve: "P-256",
            },
            true,
            ["deriveKey"],
        );
    }

    async exportPublicKey () {
        if (!this.keyPair?.publicKey) return null;
        const raw = await window.crypto.subtle.exportKey("raw", this.keyPair.publicKey);
        return btoa(String.fromCharCode(...new Uint8Array(raw)));
    }

    async deriveAesKey (peerPublicKeyRaw) {
        const peerPublicKey = await window.crypto.subtle.importKey(
            "raw",
            peerPublicKeyRaw,
            { name: "ECDH", namedCurve: "P-256" },
            false,
            [],
        );
        return window.crypto.subtle.deriveKey(
            {
                name: "ECDH",
                public: peerPublicKey,
            },
            this.keyPair?.privateKey,
            { name: "AES-GCM", length: 256 },
            false,
            ["decrypt"],
        );
    }
}
