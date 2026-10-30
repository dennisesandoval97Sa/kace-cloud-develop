import useGeneralDelete from "../../../hooks/useGeneralDelete";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import { useNavigate } from "react-router-dom";

export const useInteractionActions = () => {
    const navigate = useNavigate();

    const { mutate: deleteInteraction } = useGeneralDelete({
        keyQuery: URL_AND_KEYS.interactions.key,
    });

    return {
        handleDeleteInteraction: (id) => {
            deleteInteraction({ id, url: URL_AND_KEYS.interactions.url });
        },
        handleUpdateInteraction: (id) => {
            navigate(`/interactions/update/${id}`);
        },
        handleSeeInteraction: (id) => {
            navigate(`/interactions/update/${id}?action=see`);
        },
    };
};

export default useInteractionActions;
