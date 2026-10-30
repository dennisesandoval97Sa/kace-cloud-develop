import useGeneralDelete from "../../../hooks/useGeneralDelete";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import { useNavigate } from "react-router-dom";

export const useHelpsActions = () => {
    const navigate = useNavigate();
    const { mutate: deleteAction } = useGeneralDelete({
        keyQuery: URL_AND_KEYS.helps.key,
    });
    return {
        handleDeleteHelps: (id) => {
            deleteAction({ id, url: URL_AND_KEYS.helps.url });
        },
        handleUpdateHelps: (id) => {
            navigate(`/helps/update/${id}`);
        },
        handleSeeHelps: (id) => {
            navigate(`/helps/update/${id}?action=see`);
        },
    };
};

export default useHelpsActions;
