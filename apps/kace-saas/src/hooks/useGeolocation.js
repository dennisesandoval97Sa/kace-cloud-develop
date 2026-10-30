import { useCallback } from "react";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { getIpUser, getLocation } from "@kace/utils";
import { GEOLOCATION_SERVICE } from "@kace/urls";
import { genericHandleSendInformation } from "../services/genericHandleSendInformation";
import useGeneralMutation from "./useGeneralMutation";

const useGeolocation = () => {
    const { t } = useTranslation();

    const { mutate, isPending } = useGeneralMutation({
        keyQuery: "geolocation",
    });

    const { geolocation: geolocationFromRedux } = useSelector(
        (state) => state.generalSetup?.configAgent || { geolocation: null },
    );

    const getKeyValueIfPresent = useCallback((key, data) => data?.[key] ?? null, []);

    const prepareData = useCallback((coordinates, ip, action) => ({
        action_type: action,
        latitud: `${coordinates.lat}`,
        longitud: `${coordinates.lng}`,
        ip4_address: ip,
    }), []);

    const handleSendInformation = useCallback(async ({ coordinates, error }, ip, action) => {
        if (error === null) {
            const values = prepareData(coordinates, ip, action);
            const data = genericHandleSendInformation({
                values,
                urlService: GEOLOCATION_SERVICE,
                pending: isPending,
            });
            return mutate(data);
        }
        return Promise.resolve();
    }, [prepareData, isPending, mutate]);

    const handleGeolocation = useCallback(async (actionType = null, delay = 2000) => {
        const behavior = geolocationFromRedux;
        const send = getKeyValueIfPresent(actionType, behavior);
        const delayPromise = () => new Promise(resolve => setTimeout(resolve, delay));

        try {
            if (!send) {
                return Promise.resolve();
            }
            if (delay > 0) {
                await delayPromise();
            }

            const [location, ip] = await Promise.all([
                getLocation().catch(error => {
                    toast.error(error?.error?.message || t("errors.genericError"));
                    return { coordinates: { lat: "", lng: "" }, error };
                }),
                getIpUser().catch(() => "0.0.0.0"),
            ]);

            if (location && !location.error) {
                return handleSendInformation(location, ip, actionType);
            }

            return Promise.resolve();
        } catch (error) {
            toast.error(error?.message || t("errors.genericError"));
            return Promise.resolve();
        }
    }, [
        geolocationFromRedux,
        getKeyValueIfPresent,
        handleSendInformation,
        t,
    ]);

    return {
        handleGeolocation,
        isLoadingGeolocation: isPending,
    };
};

export default useGeolocation;
