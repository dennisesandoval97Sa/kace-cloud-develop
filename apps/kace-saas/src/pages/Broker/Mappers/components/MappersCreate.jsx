import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMemo } from "react";
import { setIn } from "formik";
import useGenericViewQuery from "@/hooks/useGenericViewQuery";
import useGeneralMutation from "@/hooks/useGeneralMutation";
import MappersCreateForm from "./MappersCreateForm";
import { genericHandleSendInformation } from "@/services/genericHandleSendInformation";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard";
import { getTranslatedError } from "@/utils/getTranslatedError";

const MAPPER_FIELD_PATH =
    /^(name|queue|rest_flow_id|rules(?:\[\d+\]|\.\d+)\.(target_entity|target_field|source_field|parse_to))$/;

export const mapBrokerMapperApiErrors = (errors) => {
    const normalizedErrors = Array.isArray(errors) ? errors : [];
    let fieldErrors = {};
    const formErrors = [];

    normalizedErrors.forEach((error) => {
        const field = error?.field;
        const message = error?.message ?? String(error);

        if (typeof field === "string" && MAPPER_FIELD_PATH.test(field)) {
            fieldErrors = setIn(fieldErrors, field, message);
        } else {
            formErrors.push({ message });
        }
    });

    return { fieldErrors, formErrors };
};

const MappersCreate = () => {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const params = useParams();
    const id = params?.id;
    const isEditMode = Boolean(id) || pathname.includes("/broker/mappers/update");

    const { data: fetchedData, isLoading: isFetching } = useGenericViewQuery({
        keyQuery: `mapper-${id}`,
        url: id ? `/broker-mappers/${id}` : "",
        enabled: !!id,
    });
    const mapperFromApi = fetchedData && (fetchedData.data ? fetchedData.data : fetchedData);

    const normalizeMapper = (a) => {
        if (!a) return {};
        const keys = ["id", "name", "queue", "rest_flow_id", "rules"];
        return keys.reduce((acc, key) => {
            const raw = a[key];
            const value = raw && typeof raw === "object" && "value" in raw ? raw.value : raw;
            acc[key] = value ?? (Array.isArray(raw) ? [] : "");
            return acc;
        }, {});
    };

    const data = useMemo(() => (mapperFromApi ? normalizeMapper(mapperFromApi) : {}), [mapperFromApi]);

    const { mutate, isPending } = useGeneralMutation({
        keyQuery: "broker.mappers",
        onErrorToast: false,
    });
    const isSending = isPending || isFetching;

    const dataHandler = async (values, setErrors, setStatus) => {
        const cleanedValues = Object.entries(values || {}).reduce((acc, [k, v]) => {
            if (v !== "" && v !== null && v !== undefined) acc[k] = v;
            return acc;
        }, {});
        const valuesToSend = { ...(isEditMode ? values : cleanedValues) };

        if (Array.isArray(valuesToSend.rules)) {
            valuesToSend.rules = valuesToSend.rules.map((r) => {
                const allowed = {};
                ["id", "mapper_id", "target_entity", "target_field", "source_field", "parse_to"].forEach((k) => {
                    if (r[k] !== undefined) allowed[k] = r[k];
                });
                return allowed;
            });
        }

        const payload = genericHandleSendInformation({
            values: valuesToSend,
            urlService: URL_AND_KEYS.broker_mappers.url,
            setFormikErrors: setErrors,
            setFormikStatus: setStatus,
            pending: isPending,
            options: { keepEmptyStrings: isEditMode, serverGeneratedId: !isEditMode },
        });
        if (isEditMode && valuesToSend.queue === "") {
            payload.dataPost.queue = null;
        }
        payload.dataPost.rules = Array.isArray(valuesToSend.rules) ? valuesToSend.rules : [];

        try {
            await mutate(payload);
            setStatus(undefined);
            navigate("/broker/mappers");
        } catch (err) {
            const responseData = err?.response?.data;
            const { fieldErrors, formErrors } = mapBrokerMapperApiErrors(responseData?.errors);
            const hasFieldErrors = Object.keys(fieldErrors).length > 0;
            const hasPublicErrorCode = Boolean(responseData?.data?.code ?? responseData?.code);
            setErrors(fieldErrors);

            if (hasFieldErrors) {
                setStatus(formErrors.length > 0 ? formErrors : undefined);
            } else if (hasPublicErrorCode) {
                setStatus(getTranslatedError(err, t));
            } else if (formErrors.length > 0) {
                setStatus(formErrors);
            } else {
                setStatus(getTranslatedError(err, t));
            }
            throw err;
        }
    };

    return (
        <DashboardSectionCard>
            <MappersCreateForm dataHandler={dataHandler} data={data} isSending={isSending} />
        </DashboardSectionCard>
    );
};

export default MappersCreate;
