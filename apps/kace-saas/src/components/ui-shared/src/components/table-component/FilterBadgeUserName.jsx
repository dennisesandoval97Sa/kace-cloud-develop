import { useQuery } from "@tanstack/react-query";
import { USER_SERVICE } from "@kace/utils";
import { genericView } from "@/services/genericView";
import { formatUserFullName } from "@/utils/userDisplay";

export function FilterBadgeUserName({ userId }) {
    const { data, isLoading } = useQuery({
        queryKey: ["searchUserToUserValue", userId],
        queryFn: () => genericView(`${USER_SERVICE}/${userId}`),
        enabled: Boolean(userId),
        staleTime: 1000 * 60 * 60 * 24,
    });
    if (isLoading) {
        return "…";
    }
    if (data && (data.nombres != null || data.apellido1 != null || data.apellido2 != null)) {
        return formatUserFullName(data) || String(userId);
    }
    return String(userId);
}
