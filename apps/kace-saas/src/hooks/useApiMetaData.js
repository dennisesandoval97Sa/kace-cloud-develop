import { useLoaderData } from "react-router-dom";

const useApiMetaData = () => {
    const {
        url = null,
        urlSchema = null,
        key = null,
        keySchema = null,
        view = null,
        urlHistory = null,
        urlRedirect = null,
    } = useLoaderData();

    return { url, urlSchema, urlHistory: urlHistory ?? url, urlRedirect, key, keySchema, view };
};

export default useApiMetaData;
