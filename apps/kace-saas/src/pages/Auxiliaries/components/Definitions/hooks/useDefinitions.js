import { genericHandleSendInformation } from "@/services/genericHandleSendInformation";
import { definitionsDataTableConfig } from "../constants";
import useGeneralMutation from "@/hooks/useGeneralMutation";
import useGenericViewQuery from "@/hooks/useGenericViewQuery";
import { useSelector } from "react-redux";

export const useDefinitions = () => {
    const id = useSelector((state) => state.modalBehavior?.idSelected);

    const { mutate, isPending } = useGeneralMutation({
        keyQuery: definitionsDataTableConfig.key,
        openModal: true,
    });

    const { data, isLoading } = useGenericViewQuery({
        url: `${definitionsDataTableConfig.url}/${id}`,
        keyQuery: definitionsDataTableConfig.key,
        searchById: [id],
        enabled: !!id,
    });

    const handleSubmit = (values, setFormikErrors, setFormikStatus) => {
        const data = genericHandleSendInformation({
            values,
            urlService: definitionsDataTableConfig.url,
            setFormikErrors,
            setFormikStatus,
            pending: isPending,
        });
        mutate(data);
    };

    return {
        dataHandler: handleSubmit,
        data,
        isLoading,
        isPending,
    };
};
