import useGeneralMutation from "@kace/hooks/useGeneralMutation";
import { genericHandleSendInformation } from "../../../../../services/genericHandleSendInformation";
import { URL_AND_KEYS } from "../../../../../utils/urlAndKeys";

const useAdminCaseDescription = () => {
    const { mutateAsync, isPending } = useGeneralMutation({
        setOpen: false,
        invalidateQueries: false,
        onSuccessToast: false,
    });

    const handleCreateDescription = async (descriptionId, descripcion, isNewDescription) => {
        const dataPost = { id: descriptionId, descripcion };
        const data = genericHandleSendInformation({
            values: dataPost,
            urlService: URL_AND_KEYS.cases.urlDescription,
            pending: isPending,
            options: { isCreate: isNewDescription, keepId: isNewDescription },
        });
        await mutateAsync(data);
    };

    return { handleCreateDescription };
};

export default useAdminCaseDescription;
