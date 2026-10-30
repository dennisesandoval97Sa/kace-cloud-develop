import axios from "axios";
import { toast } from "sonner";
import { API } from "../../main";
import getClientFingerprint from "../../fingerprint";
import {TENANT_ID} from "@/utils/URL";

const api = axios.create({
    baseURL: API.BASE_URL,
    timeout: 10000,
    headers: {
        "Content-Type": "application/json",
    },
});

api.interceptors.request.use(
    async (config) => {
        config.headers["X-Client-Fingerprint"] = await getClientFingerprint();
        config.headers["X-Tenant-Id"] = TENANT_ID;
        return config;
    },
    (error) => {
        return Promise.reject(error);
    },
);

api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response) {
            switch (error.response.status) {
                case 400:
                    toast.error(
                    `${error.response.data.message} ${String(error.config.url).replace(/^\//, "")}`,
                    { duration: 3000 },
                    );
                    break;
                case 401:
                    toast.error(
                    `${error.response.data.message} ${String(error.config.url).replace(/^\//, "")}`,
                    { duration: 3000 },
                    );
                    break;
                case 404:
                    toast.error(
                    `${error.response.data.message} ${String(error.config.url).replace(/^\//, "")}`,
                    { duration: 3000 },
                    );
                    break;
                case 500:
                    toast.error(
                    `${error.response.data.message} ${String(error.config.url).replace(/^\//, "")}`,
                    { duration: 2000 },
                    );
                    break;
                default:
                    toast.error(
                    `${error.response.data.message} ${String(error.config.url).replace(/^\//, "")}`,
                    { duration: 3000 },
                    );
                    break;
            }
        }
        return Promise.reject(error);
    },
);

export const apiServiceAWS = {
    get: (url, config = {}) => api.get(url, config),
    post: (url, data, config = {}) => api.post(url, data, config),
    put: (url, data, config = {}) => api.put(url, data, config),
    delete: (url, config = {}) => api.delete(url, config),
};
