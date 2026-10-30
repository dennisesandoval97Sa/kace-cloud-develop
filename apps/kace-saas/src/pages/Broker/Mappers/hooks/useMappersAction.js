import { useNavigate } from "react-router-dom";
import useGeneralDelete from "@/hooks/useGeneralDelete";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const useMappersAction = () => {
    const navigate = useNavigate();
    const { mutate: deleteAction } = useGeneralDelete({ keyQuery: URL_AND_KEYS.broker_mappers.key });
    
    return {
        handleUpdate: (id) => {
            navigate(`/broker/mappers/update/${id}`);
        },
        handleDelete: (id) => {
            deleteAction({ id, url: URL_AND_KEYS.broker_mappers.url });
        },
        handleSee: (id) => {
            navigate(`/broker/mappers/update/${id}?action=see`);
        },
    };
};

export default useMappersAction;
