import { findPublicErrorCode } from "@kace/error-codes";

const LEGACY_AUTH_ERROR_CODE_PATTERN = /^0x07([0-9a-fA-F]{2})$/;

function findAuthErrorCode(...codes) {
    for (const code of codes) {
        const publicCode = findPublicErrorCode(code);
        if (publicCode) {
            return publicCode;
        }

        if (typeof code === "string") {
            const legacyAuthCodeMatch = code.trim().match(LEGACY_AUTH_ERROR_CODE_PATTERN);
            if (legacyAuthCodeMatch) {
                const migratedCode = `0x0700${legacyAuthCodeMatch[1]}`;
                const migratedPublicCode = findPublicErrorCode(migratedCode);
                if (migratedPublicCode) {
                    return migratedPublicCode;
                }
            }
        }
    }

    return undefined;
}

export function extractAuthErrorCode(error) {
    const data = error?.response?.data;
    if (!data) {
        return undefined;
    }

    const messageCode =
        typeof data?.message === "string"
            ? data.message.match(/:(0x(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{4}))$/)?.[1]
            : undefined;
    const code = findAuthErrorCode(data?.data?.code, data?.code, messageCode);
    if (code) {
        return code;
    }

    return undefined;
}
