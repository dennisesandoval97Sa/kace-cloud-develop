import useUserInformation from "@/hooks/useUserInformation";
import { useMemo } from "react";
import useAdminCaseCacheData from "./useAdminCaseCacheData";
import useAdminCaseParams from "./useAdminCaseParams";

const useAdminCaseUserInfo = () => {
    const { permissionsAdmin, user } = useUserInformation();
    const { caseCacheData } = useAdminCaseCacheData();
    const { extraParam } = useAdminCaseParams();

    const canCaseUpdateNotOwner = permissionsAdmin.filter(
        (item) => item.name === "CaseUpdateNotOwner",
    );

    const designatedId = useMemo(
        () => caseCacheData?.responsable_id || null,
        [caseCacheData?.responsable_id],
    );

    const userCanEditCase = useMemo(() => {
        if (extraParam === "create") {
            return true;
        }
        return designatedId === user.id || canCaseUpdateNotOwner[0]?.granted || false;
    }, [designatedId, user.id, canCaseUpdateNotOwner]);

    return {
        selectedGroup: user?.selectedGroup,
        responsibleId: user?.id,
        userCanEditCase,
    };
};

export default useAdminCaseUserInfo;
