import useGeolocation from "@kace/hooks/useGeolocation";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { GeolocationTypes } from "../../../../../enums/GeolocationTypes";
import useGeneralMutation from "../../../../../hooks/useGeneralMutation";
import useGenericViewQuery from "../../../../../hooks/useGenericViewQuery";
import { genericHandleSendInformation } from "../../../../../services/genericHandleSendInformation";
import { CLIENT_SERVICE } from "../../../../../utils/URL";
import { TYPE_CUSTOMER } from "@/utils/main";

const useClientsManagement = () => {
    const { handleGeolocation } = useGeolocation();
    const navigate = useNavigate();

    const handleGeolocationClient = async (isNewClient) => {
        const behavior = isNewClient ? GeolocationTypes.CLIENT_CREATION : GeolocationTypes.CLIENT_UPDATE;
        await handleGeolocation(behavior.value);
    };
    const { data: dataLiterals, isLoading: isLoadingLiterals } = useGenericViewQuery({
        keyQuery: "literalsClients",
        url: "/clients_doc_types",
        staleTime: 1000 * 60 * 60,
        options: {
            refetchOnWindowFocus: false,
            retry: 1,
        },
    });

    const { mutate, isPending } = useGeneralMutation({
        keyQuery: "casesByAgent",
    });

    const handleUsers = (values, setFormikErrors, setFormikStatus, clientId, isNewClient = false) => {
        const filterValues = Object.fromEntries(
            Object.entries(values).filter(
                ([key, value]) => key === "id" || (value !== "" && value !== undefined && value !== null),
            ),
        );
        const data = genericHandleSendInformation({
            values: filterValues,
            urlService: CLIENT_SERVICE,
            fields: ["contactos"],
            setFormikErrors,
            setFormikStatus,
            pending: isPending,
            options: { isCreate: isNewClient, serverGeneratedId: isNewClient },
        });
        if (data.dataPost.tipo_cliente === TYPE_CUSTOMER.COMMERCIAL) {
            data.dataPost.contactos = values.contactos || [];
        }
        mutate(data, {
            onSuccess: async (response) => {
                const responseId = response?.data?.data?.id ?? response?.data?.id ?? clientId;
                await handleGeolocationClient(isNewClient);
                navigate(`/agent/${responseId}`);
            },
            onError: () => {
                toast.warning("Error al realizarlo");
            },
        });
    };

    const handleSetLiteral = (name, value) => {
        if (value) {
            const model = Object.entries(value)
                .filter(([key]) => key.split("/")[0] === name)
                .reduce((acc, [key, val]) => {
                    acc.label = key.split("/")[1];
                    acc.data = val.map((item) => ({
                        label: item,
                        value: item,
                    }));
                    return acc;
                }, {});
            return model;
        } else {
            return { label: "", data: [] };
        }
    };

    return {
        handleUsers,
        handleSetLiteral,
        dataLiterals,
        isLoadingLiterals,
        isPending,
    };
};

export default useClientsManagement;
