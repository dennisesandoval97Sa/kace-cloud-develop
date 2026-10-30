import { apiService } from "@/utils/main";
import { COGNITO_AUTHENTICATION, COGNITO_CLIENT_ID, COGNITO_REDIRECT_URI, COGNITO_URL } from "../utils/URL";
import axiosHttpClient from "./AxiosHttpClient";
import { toast } from "sonner";
import { t } from "i18next";

export const getCognitoCredentials = async (code) => {
    const configuration = {
        grant_type: "authorization_code",
        client_id: COGNITO_CLIENT_ID,
        code,
        redirect_uri: COGNITO_REDIRECT_URI,
    };

    const payload = new URLSearchParams(configuration).toString();
    const response = await axiosHttpClient.post(`${COGNITO_URL}/oauth2/token`, payload, {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
    });
    return response.data;
};

export const handlerLogout = async (user_id = null) => {
    try {
        const url = `${COGNITO_AUTHENTICATION}/logout`;
        await apiService.post(url, { user_id });
        toast.success(t("app.alerts.successLogout"));
    } catch (error) {
        toast.error(t("app.alerts.errorLogout"));
        throw new Error("Error al cerrar sesión");
    }
};
