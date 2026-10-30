import useAuxiliariesOptions from "@/hooks/useAuxiliariesOptions";
import { buildAuxClientsRoutesObjects } from "@/pages/MassiveExecution/utils/extractAuxClientsRoutes";
import { useMemo } from "react";

const useMassiveExecutionClients = () => {
    const { rulesData, loading } = useAuxiliariesOptions();
    const clientRoutesOptions = useMemo(() => {
        if (!rulesData?.clients?.data_structure) return { routes: [], fields: [] };

        return buildAuxClientsRoutesObjects(rulesData.clients.data_structure);
    }, [rulesData.clients]);

    return { clientRoutesOptions, loading };
};

export default useMassiveExecutionClients;
