import { KeyService } from "@/services/CryptoKeyService";
import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiService } from "@/utils/src/services/apiService";
import { SCHEMA_FIELDS_SERVICE } from "@/utils/URL";

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
}

const removeSchemaFieldsFromLocalStorage = () => {
    const schemaFields = localStorage.getItem("schemaFields");
    if (schemaFields) {
        localStorage.removeItem("schemaFields");
    }
};

const fetchSchemaFields = async () => {
    removeSchemaFieldsFromLocalStorage();
    const ks = await KeyService.getInstance();
    const myPublicKey = await ks.exportPublicKey();
    if (!myPublicKey) throw new Error("No public key");

    const response = await apiService.get(SCHEMA_FIELDS_SERVICE, {
        headers: { "X-Public-Key": myPublicKey },
    });
    const { iv, ciphertext, serverPubKey } = response.data.data;

    const aesKey = await ks.deriveAesKey(base64ToArrayBuffer(serverPubKey));
    const plainBuf = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(base64ToArrayBuffer(iv)) },
        aesKey,
        base64ToArrayBuffer(ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(plainBuf));
};

const useSchemaFields = (isAuthenticated = false) => {
    const { data: schemaFields, refetch } = useQuery({
        queryKey: ["schemaFields"],
        queryFn: fetchSchemaFields,
        staleTime: 1000 * 60 * 60,
        gcTime: 1000 * 60 * 60 * 2,
        refetchOnWindowFocus: false,
        retry: 2,
        enabled: isAuthenticated,
    });

    const processSchemaFields = useCallback(async () => {
        return await refetch();
    }, [refetch]);

    const getSchemaField = useCallback(
        (schema) => {
            if (!schemaFields) return [];

            if (schemaFields[schema]) {
                return schemaFields[schema];
            }

            return [];
        },
        [schemaFields],
    );

    const getFieldData = useCallback(
        (path = null) => {
            if (!path) return null;
            if (!schemaFields) return [];

            const [arrayKey, columnName] = path.split(".");

            const array = schemaFields[arrayKey];
            if (!Array.isArray(array)) return undefined;

            return array.find((item) => item.column_name === columnName);
        },
        [schemaFields],
    );

    return { schemaFields, processSchemaFields, getSchemaField, getFieldData };
};

export default useSchemaFields;
