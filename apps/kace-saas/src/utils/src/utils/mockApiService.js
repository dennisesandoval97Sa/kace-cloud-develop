/**
 * This is an object containing any mocked request, where the `key` is the exact url match
 * and the `value` is the complete response object, as expected from the backend
 * i.e.: "/mock-route/search": { message: "Success", data: { items: [] }, metadata: { count: "1" } }
 */

const MOCK_RESPONSES = {};

export const hasMock = (url) => !!MOCK_RESPONSES[url];

export const mockRequest = (url, data) => {
    return {
        data: MOCK_RESPONSES[url],
        status: 200,
        statusText: "",
        headers: {
            "cache-control": "no-store, no-cache",
            "content-length": "1841",
            "content-type": "application/json",
        },
        config: {
            transitional: {
                silentJSONParsing: true,
                forcedJSONParsing: true,
                clarifyTimeoutError: false,
            },
            adapter: ["xhr", "http", "fetch"],
            transformRequest: [null],
            transformResponse: [null],
            timeout: 40000,
            xsrfCookieName: "XSRF-TOKEN",
            xsrfHeaderName: "X-XSRF-TOKEN",
            maxContentLength: -1,
            maxBodyLength: -1,
            env: {},
            headers: {
                Accept: "application/json, text/plain, */*",
                Authorization: "mock-token",
                "Content-Type": "application/json",
            },
            baseURL: "https://developmentapi.kace-cloud.com",
            method: "post",
            url,
            data,
            allowAbsoluteUrls: true,
        },
        request: {},
    };
};
