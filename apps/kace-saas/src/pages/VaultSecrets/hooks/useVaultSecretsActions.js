import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import { useDispatch } from "react-redux";
import useGeneralDelete from "../../../hooks/useGeneralDelete";
import { setIdSelectedAndDisableEdit, setIdSelectedAndEnableEdit, setOpenModal } from "../../../redux/state/modalBehavior";

const useVaultSecretsActions = () => {
    const dispatch = useDispatch();
    const { mutate: deleteAction } = useGeneralDelete({
        keyQuery: URL_AND_KEYS.vaultSecret.key,
    });

    return {
        handleDeleteSecretVault: (id) => {
            deleteAction({ id, url: URL_AND_KEYS.vaultSecret.url });
        },
        handleUpdateSecretVault: (id) => {
            dispatch(setIdSelectedAndEnableEdit(id));
            dispatch(setOpenModal(true));
        },
        handleSeeSecretVault: (id) => {
            dispatch(setIdSelectedAndDisableEdit(id));
            dispatch(setOpenModal(true));
        },

    };
};

export default useVaultSecretsActions;
