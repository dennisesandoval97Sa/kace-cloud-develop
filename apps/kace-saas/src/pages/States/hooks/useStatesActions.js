import { useDispatch } from "react-redux";
import useGeneralDelete from "@kace/hooks/useGeneralDelete.js";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys.js";
import {
    setIdSelectedAndDisableEdit,
    setIdSelectedAndEnableEdit,
    setOpenModal,
} from "../../../redux/state/modalBehavior.js";

const useStatesActions = () => {
    const dispatch = useDispatch();
    const { mutate: deleteAction } = useGeneralDelete({
        keyQuery: URL_AND_KEYS.states.key,
    });

    return {
        handleDeleteState: (id) => {
            deleteAction({ id, url: URL_AND_KEYS.states.url });
        },
        handleUpdateState: (id) => {
            dispatch(setIdSelectedAndEnableEdit(id));
            dispatch(setOpenModal(true));
        },
        handleSeeState: (id) => {
            dispatch(setIdSelectedAndDisableEdit(id));
            dispatch(setOpenModal(true));
        },
    };
};

export default useStatesActions;
