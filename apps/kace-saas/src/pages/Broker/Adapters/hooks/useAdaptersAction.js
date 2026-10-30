import { useNavigate } from "react-router-dom";
import useGeneralDelete from "@/hooks/useGeneralDelete";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const useAdaptersAction = () => {
    const navigate = useNavigate();
    const { mutate: deleteAction } = useGeneralDelete({ keyQuery: URL_AND_KEYS.broker_adapters.key });
    
    return {
        handleUpdate: (id) => {
            navigate(`/broker/adapters/update/${id}`);
        },
        handleDelete: (id) => {
            deleteAction({ id, url: URL_AND_KEYS.broker_adapters.url });
        },
        handleSee: (id) => {
            navigate(`/broker/adapters/update/${id}?action=see`);
        },
    };
};

export default useAdaptersAction;
