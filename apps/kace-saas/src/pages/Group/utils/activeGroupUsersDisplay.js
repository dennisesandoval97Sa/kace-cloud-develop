import { PUBLIC_ERROR_CODES, findPublicErrorCode } from "@kace/error-codes";
import { formatUserFullName } from "@/utils/userDisplay";

export { formatUserFullName as formatActiveGroupUserName };

export function parseGroupHasActiveUsersError(error) {
    const responseData = error?.response?.data;
    const code = findPublicErrorCode(responseData?.data?.code, responseData?.code);
    if (code !== PUBLIC_ERROR_CODES.GROUP_HAS_ACTIVE_USERS) {
        return null;
    }

    const users = Array.isArray(responseData?.data?.users) ? responseData.data.users : [];
    const count = Number(responseData?.data?.count ?? users.length) || users.length;

    return {
        count,
        users,
        message: responseData?.message ?? "",
    };
}
