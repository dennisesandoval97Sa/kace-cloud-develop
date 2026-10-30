import { useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useQueryClient } from "@tanstack/react-query";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { apiService } from "@/utils/main";
import { setShowGroupsSelect } from "@/redux/state/showGroupSelect";
import { broadcastGroupChanged, USER_GROUP_ID_KEY } from "@/utils/groupSyncChannel";

const useGroupMembershipValidation = () => {
    const dispatch = useDispatch();
    const queryClient = useQueryClient();
    const isValidatingRef = useRef(false);
    const configAdmin = useSelector((state) => state.generalSetup.configAdmin);
    const intervalMinutes = configAdmin?.users?.group_membership_check_interval ?? 0;
    const intervalMs = intervalMinutes > 0 ? intervalMinutes * 60 * 1000 : null;

    useEffect(() => {
        if (!intervalMs) return;

        const validate = async () => {
            if (isValidatingRef.current) return;

            const currentGroupId = localStorage.getItem(USER_GROUP_ID_KEY);
            if (!currentGroupId) return;

            isValidatingRef.current = true;
            try {
                const url = `${URL_AND_KEYS.validateGroup.url}?group_id=${currentGroupId}`;
                const response = await apiService.get(url);
                const data = response?.data?.data;

                if (data?.belongs_to_group === false) {
                    const newGroupId = data?.current_grupo_activo ?? null;
                    localStorage.removeItem(USER_GROUP_ID_KEY);
                    broadcastGroupChanged(newGroupId);
                    await queryClient.invalidateQueries({ queryKey: ["userInformation"] });
                    await queryClient.refetchQueries({ queryKey: ["userInformation"] });
                    dispatch(setShowGroupsSelect(true));
                }
            } finally {
                isValidatingRef.current = false;
            }
        };

        const intervalId = setInterval(validate, intervalMs);
        return () => clearInterval(intervalId);
    }, [intervalMs, dispatch, queryClient]);
};

export default useGroupMembershipValidation;
