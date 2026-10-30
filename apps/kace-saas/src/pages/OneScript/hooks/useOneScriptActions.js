import { useDispatch } from "react-redux";
import useGeneralDelete from "../../../hooks/useGeneralDelete";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import { setIdSelectedAndDisableEdit, setIdSelectedAndEnableEdit, setOpenModal } from "../../../redux/state/modalBehavior";

export const useOneScriptActions = () => {
    const dispatch = useDispatch();
    const { mutate: deleteAction } = useGeneralDelete({
        keyQuery: URL_AND_KEYS.oneScript.key,
    });

    return {
        handleDeleteOneScript: (id) => {
            deleteAction({ id, url: URL_AND_KEYS.oneScript.url });
        },
        handleUpdateOneScript: (id) => {
            dispatch(setIdSelectedAndEnableEdit(id));
            dispatch(setOpenModal(true));
        },
        handleSeeOneScript: (id) => {
            dispatch(setIdSelectedAndDisableEdit(id));
            dispatch(setOpenModal(true));
        },
    };
};
