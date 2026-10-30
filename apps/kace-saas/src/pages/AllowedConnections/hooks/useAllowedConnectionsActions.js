import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import useGeneralDelete from "../../../hooks/useGeneralDelete";
import { useDispatch } from "react-redux";
import { setIdSelectedAndDisableEdit, setIdSelectedAndEnableEdit, setOpenModal } from "../../../redux/state/modalBehavior";

const useAllowedConnectionsActions = () => {
    const dispatch = useDispatch();
    const { mutate: deleteAction } = useGeneralDelete({
        keyQuery: URL_AND_KEYS.allowedConnections.key,
    });

    return {
        handleDeleteAllowedConnections: (id) => {
            deleteAction({ id, url: URL_AND_KEYS.allowedConnections.url });
        },
        handleUpdateAllowedConnections: (id) => {
            dispatch(setIdSelectedAndEnableEdit(id));
            dispatch(setOpenModal(true));
        },
        handleSeeAllowedConnections: (id) => {
            dispatch(setIdSelectedAndDisableEdit(id));
            dispatch(setOpenModal(true));
        },
    };
};

export default useAllowedConnectionsActions;
