import { useParams } from "react-router-dom";
import { validate as uuidValidate } from "uuid";

export const useLoadedAgentClientId = () => {
    const { clientId } = useParams();
    if (!clientId || !uuidValidate(clientId)) {
        return null;
    }
    return clientId;
};
