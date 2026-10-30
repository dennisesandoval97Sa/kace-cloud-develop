import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import useGenericViewQuery from "@/hooks/useGenericViewQuery";
import useGeneralMutation from "@/hooks/useGeneralMutation";
import { genericHandleSendInformation } from "@/services/genericHandleSendInformation";
import AdaptersCreateForm from "./AdaptersCreateForm";
import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard";
import { ROUTES } from "@/config/routesDictionary";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const AdaptersCreate = () => {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const params = useParams();
    const id = params?.id;
    const isEditMode = Boolean(id) || pathname.includes("/broker/adapters/update");

    const { data: fetchedData, isLoading: isFetching } = useGenericViewQuery({
        keyQuery: `adapter-${id}`,
        url: id ? `/broker-adapters/${id}` : "",
        enabled: !!id,
    });

    const adapterFromApi = fetchedData && (fetchedData.data ? fetchedData.data : fetchedData);

    const normalizeAdapter = (a) => {
        if (!a) return {};
        const keys = ["id", "name", "host", "port", "queue", "exchange", "vhost", "username", "password"];
        return keys.reduce((acc, key) => {
            const raw = a[key];
            const value = raw && typeof raw === "object" && "value" in raw ? raw.value : raw;
            acc[key] = value ?? "";
            return acc;
        }, {});
    };

    const data = adapterFromApi ? normalizeAdapter(adapterFromApi) : {};

    const { mutate, isPending } = useGeneralMutation({ keyQuery: "broker.adapters" });
    const isSending = isPending || isFetching;

    const dataHandler = async (values, setErrors, setStatus) => {
        const cleanedValues = Object.entries(values || {}).reduce((acc, [k, v]) => {
            if (v !== "" && v !== null && v !== undefined) acc[k] = v;
            return acc;
        }, {});

        const valuesToSend = isEditMode ? values : cleanedValues;

        const payload = genericHandleSendInformation({
            values: valuesToSend,
            urlService: URL_AND_KEYS.broker_adapters.url,
            setFormikErrors: setErrors,
            setFormikStatus: setStatus,
            pending: isPending,
            options: { keepEmptyStrings: isEditMode, serverGeneratedId: !isEditMode },
        });

        try {
            await mutate(payload);
            setStatus({ success: true, message: t("broker.adapters.saved") || "Saved" });
            navigate(ROUTES.BROKER_ADAPTERS.path);
        } catch (err) {
            if (err && err.errors) setErrors(err.errors);
            setStatus({ success: false, message: err.message || t("broker.adapters.error") || "Error" });
            throw err;
        }
    };

    return (
        <DashboardSectionCard>
            <AdaptersCreateForm dataHandler={dataHandler} data={data} isSending={isSending} />
        </DashboardSectionCard>
    );
};

export default AdaptersCreate;
