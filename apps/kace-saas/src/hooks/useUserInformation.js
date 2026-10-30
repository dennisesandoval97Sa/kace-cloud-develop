import { useQueryClient } from "@tanstack/react-query";

const useUserInformation = () => {
    const queryClient = useQueryClient();
    const userCache = queryClient.getQueryData(["userInformation"]);
    const permissionsAgent = userCache?.permisions?.agente || [];
    const permissionsAdmin = userCache?.permisions?.administrador || [];
    const permissionsAuxiliaries = userCache?.permisions?.auxiliaries || [];
    const user = userCache?.user || {};
    const groups = userCache?.groups || [];
    const current_group = userCache?.user?.grupo_activo || null;
    const active_group_id = user?.grupo_activo || user?.selectedGroup || null;

    if (user?.id) {
        localStorage.setItem("userId", user.id);
    }

    return {
        permissionsAgent,
        user,
        groups,
        permissionsAdmin,
        permissionsAuxiliaries,
        current_group,
        active_group_id,
        userCache,
    };
};

export default useUserInformation;
