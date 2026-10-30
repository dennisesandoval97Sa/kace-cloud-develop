import { useMemo } from "react";
import useGenericSearchQuery from "./useGenericSearchQuery";
import { URL_AND_KEYS } from "../utils/urlAndKeys";
import { getDomainFromUrl } from "../services/urlValidator";

/**
 * Hook para validar si una URL está permitida según el servicio de conexiones.
 * @param {string} url - URL a validar.
 * @returns {{
 *   isAllowed: boolean,
 *   isLoading: boolean,
 *   error: Error | null
 * }}
 */
const useAllowedConnections = (url) => {
    const domain = useMemo(() => getDomainFromUrl(url), [url]);

    const { data, isLoading, error } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.allowedConnections.url}/search`,
        keyQuery: URL_AND_KEYS.allowedConnections.key,
        filter: [
            {
                field: "is_active",
                operator: "eq",
                value: 1,
                type: "AND",
            },
            {
                field: "connection",
                operator: "eq",
                value: domain,
                type: "AND",
            },
        ],
        enabled: !!domain,
    });

    const isAllowed = useMemo(() => {
        if (!domain) return false;
        return data?.data?.length > 0;
    }, [data]);

    return {
        isAllowed,
        isLoading,
        error,
    };
};

export default useAllowedConnections;
