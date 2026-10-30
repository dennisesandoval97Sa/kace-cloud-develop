import { validateError } from "@/utils/src/services/validationErrors";
import { apiService } from "../utils/main";
import { ensureValidAuthTokens } from "../utils/src/services/apiService.js";
import { COGNITO_AUTHENTICATION } from "../utils/URL";

export function mapAuthCognitoResponse(response) {
    if (response.status !== 200) {
        throw new Error("Failed to fetch user data");
    }
    const groupId = localStorage.getItem("userGroupId");
    if (Object.keys(response.data.data).length > 0) {
        const userGroups = response.data.data.groups ?? [];
        if (groupId && userGroups.some((g) => g.id === groupId)) {
            response.data.data.user.selectedGroup = groupId;
        } else if (groupId) {
            localStorage.removeItem("userGroupId");
        }
    }
    return response.data.data;
}

export const fetchUserData = async (tokens) => {
    // `tokens` only gates session presence (the call site enables the query with
    // `enabled: Boolean(tokens)`). The token set actually posted comes from
    // ensureValidAuthTokens(), which always resolves with a valid token set or throws.
    if (!tokens) throw new Error("No tokens available");
    try {
        // /auth-cognito verifies the BODY id_token server-side and 401s ("Invalid token")
        // if it is expired. The request interceptor only refreshes the Authorization header,
        // not this body, so ensure a non-expired token set before posting.
        const activeTokens = await ensureValidAuthTokens();
        const response = await apiService.post(COGNITO_AUTHENTICATION, activeTokens);
        return mapAuthCognitoResponse(response);
    } catch (error) {
        const customError = validateError(error);
        if (customError) {
            throw customError;
        }

        throw error;
    }
};
