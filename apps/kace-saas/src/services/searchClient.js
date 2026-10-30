import { CLIENT_SERVICE } from "../utils/URL";
import { URL_AND_KEYS } from "../utils/urlAndKeys";
import { genericSearch } from "./genericSearch";
import { genericSearchService } from "./genericSearchService";

export const searchClient = async (id) => {
    const response = await genericSearch(`${CLIENT_SERVICE}/search`, {
        filter: [
            {
                field: "id",
                operator: "eq",
                value: id,
                type: "AND",
            },
        ],
        limit: 10,
        offset: 0,
    });
    return response;
};

export const searchDescription = async (id) => {
    const response = await genericSearch(`${CLIENT_SERVICE}/search`, {
        filter: [
            {
                field: "id",
                operator: "eq",
                value: id,
                type: "AND",
            },
        ],
        limit: 1,
        offset: 0,
    });
    return response;
};

export const searchClientFetch = async (data) => {
    const response = await genericSearch(`${CLIENT_SERVICE}/search`, [
        {
            field: data.type,
            operator: "ilike",
            value: data.payload,
            type: "AND",
        },
        {
            field: "status",
            operator: "eq",
            value: 1,
            type: "AND",
        },
    ]);
    return response;
};

export const searchCasesByField = async (data) => {
    const response = await genericSearchService(
        `${URL_AND_KEYS.cases.url}/search`,
        [
            {
                field: data.type,
                operator: "eq",
                value: data.payload,
                type: "AND",
            },
        ],
        {
            limit: 10,
            offset: 0,
        },
        "cases",
    );
    return response;
};
