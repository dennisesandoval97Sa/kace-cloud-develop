import { genericSearchService } from "@/services/genericSearchService";
import { CLIENT_SERVICE } from "@/utils/URL";

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const MAX_SUGGESTED_CLIENTS = 50;

const normalizeEmail = (value) =>
    String(value ?? "")
        .trim()
        .toLowerCase();

export const extractSenderEmailAddress = (value) => {
    const matches = String(value ?? "").match(EMAIL_PATTERN) ?? [];
    const uniqueMatches = [...new Set(matches.map(normalizeEmail).filter(Boolean))];

    return uniqueMatches.length === 1 ? uniqueMatches[0] : "";
};

export const getSuggestedClientMatchedFields = (client, senderEmail) => {
    const normalizedSenderEmail = normalizeEmail(senderEmail);

    return [{ key: "email", value: client?.email }].filter(
        ({ value }) => normalizeEmail(value) === normalizedSenderEmail,
    );
};

export const filterExactSuggestedClients = (clients, senderEmail) => {
    const uniqueClients = new Map();

    (Array.isArray(clients) ? clients : []).forEach((client) => {
        const matchedFields = getSuggestedClientMatchedFields(client, senderEmail);

        if (
            client?.id === null ||
            client?.id === undefined ||
            matchedFields.length === 0 ||
            uniqueClients.has(String(client.id))
        ) {
            return;
        }

        uniqueClients.set(String(client.id), {
            ...client,
            suggestedClientMatchedFields: matchedFields,
        });
    });

    return [...uniqueClients.values()];
};

export const buildSuggestedClientFilters = (senderEmail) => [
    {
        field: "email",
        operator: "ilike",
        value: senderEmail,
        type: "AND",
    },
    {
        field: "status",
        operator: "eq",
        value: 1,
        type: "AND",
    },
];

export const searchSuggestedClientsByEmail = async (rawSenderEmail) => {
    const senderEmail = extractSenderEmailAddress(rawSenderEmail);

    if (!senderEmail) return { senderEmail: "", clients: [] };

    const response = await genericSearchService(
        `${CLIENT_SERVICE}/search`,
        buildSuggestedClientFilters(senderEmail),
        { limit: MAX_SUGGESTED_CLIENTS, offset: 0 },
        "clients",
    );

    return {
        senderEmail,
        clients: filterExactSuggestedClients(response?.data, senderEmail),
    };
};
