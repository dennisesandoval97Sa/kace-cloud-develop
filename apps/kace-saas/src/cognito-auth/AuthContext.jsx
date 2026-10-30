import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { getCognitoCredentials, handlerLogout } from "../services/cognitoService";
import PropTypes from "prop-types";
import { COGNITO_LOGIN, COGNITO_LOGOUT, COGNITO_AUTHENTICATION } from "../utils/URL";
import { fetchUserData, mapAuthCognitoResponse } from "../services/userService";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useUserInformation from "@/hooks/useUserInformation";
import useSchemaFields from "@/hooks/useSchemaFields";
import useFingerprint from "@/hooks/useFingerprint";
import { armUnloadBypassForForcedSessionEnd } from "@/utils/kaceSessionUnloadBypass";
import {
    API_SESSION_AUTH_FAILED_EVENT,
    API_SESSION_CONFLICT_EVENT,
    AUTH_ERROR_SESSION_ACTIVE_ON_ANOTHER_DEVICE,
    AUTH_ERROR_SESSION_KEY_MISMATCH,
    AUTH_ERROR_SESSION_COOKIE_STALE,
    resetSessionConflictEventSuppression,
    shouldEmitSessionConflictEvent,
    suppressSessionConflictEvents,
} from "@/utils/apiAuthEvents";
import { apiService } from "@/utils/main";
import { ensureValidAuthTokens } from "@/utils/src/services/apiService.js";
import { clearPersistedState } from "@kace_v2/shared/utils/persistentStorage.util";

import {
    readActiveAuthTokens,
    stagePendingAuthTokens,
    commitAuthTokensToLocalStorage,
    rejectPendingAuthSession,
    SESSION_REJECTED_STORAGE_KEY,
} from "@/utils/authPendingSession";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const { user } = useUserInformation();
    const { fingerprint, isLoading: isLoadingFingerprint } = useFingerprint();
    const [tokens, setTokens] = useState(() => readActiveAuthTokens());

    const [hasErrorAuth, setHasErrorAuth] = useState(false);
    const [hasCredentials, setHasCredentials] = useState(false);
    const [inactiveUser, setInactiveUser] = useState(false);
    const [isAuthenticated, setisAuthenticated] = useState(false);
    const [isFingerprintError, setIsFingerprintError] = useState(false);
    const [isSessionConflict, setIsSessionConflict] = useState(false);
    const [isSessionTakenOver, setIsSessionTakenOver] = useState(false);
    const [isSessionRejected, setIsSessionRejected] = useState(
        () => sessionStorage.getItem(SESSION_REJECTED_STORAGE_KEY) === "1",
    );
    const [conflictOriginalRequest, setConflictOriginalRequest] = useState(null);
    const queryClient = useQueryClient();

    const { processSchemaFields } = useSchemaFields(isAuthenticated);

    const {
        data: userInformation,
        isLoading: isLoadingUserInformation,
        isError: isErrorUserInformation,
        error,
        refetch,
    } = useQuery({
        queryKey: ["userInformation"],
        queryFn: () => fetchUserData(tokens),
        enabled: Boolean(tokens),
        staleTime: 1000 * 60 * 60 * 23,
        refetchOnWindowFocus: false,
        gcTime: 1000 * 60 * 60 * 24,
    });

    let hasFetched = false;

    useEffect(() => {
        const isOnLogoutPage = window.location.pathname === "/logout";
        if (!isOnLogoutPage) {
            const expirationTime = localStorage.getItem("sessionExpiration");

            if (expirationTime && expirationTime < Date.now()) {
                logout();
                return;
            }

            if (tokens) {
                setHasCredentials(true);
                return;
            }

            if (hasCredentials) {
                return;
            }

            const authenticateUser = async () => {
                if (hasFetched) {
                    return;
                }

                if (sessionStorage.getItem(SESSION_REJECTED_STORAGE_KEY) === "1") {
                    return;
                }

                try {
                    const params = new URLSearchParams(window.location.search);
                    const code = params.get("code");

                    if (!code) {
                        window.location.href = COGNITO_LOGIN;
                        return;
                    }

                    if (!tokens && code) {
                        hasFetched = true;
                        resetSessionConflictEventSuppression();
                        const tokenData = await getCognitoCredentials(code);
                        stagePendingAuthTokens(tokenData);
                        setTokens(tokenData);
                    }

                    setHasCredentials(true);
                } catch (error) {
                    setHasErrorAuth(true);
                    throw new Error(error);
                }
            };
            authenticateUser();
        }
    }, [tokens]);

    useEffect(() => {
        const onApiSessionAuthFailed = (e) => {
            const code = e.detail?.code;
            if (code === AUTH_ERROR_SESSION_KEY_MISMATCH) {
                setIsSessionTakenOver(true);
            } else if (code === AUTH_ERROR_SESSION_COOKIE_STALE) {
                return;
            } else {
                setHasErrorAuth(true);
            }
        };
        window.addEventListener(API_SESSION_AUTH_FAILED_EVENT, onApiSessionAuthFailed);
        return () => window.removeEventListener(API_SESSION_AUTH_FAILED_EVENT, onApiSessionAuthFailed);
    }, []);

    useEffect(() => {
        const onApiSessionConflict = (e) => {
            if (!shouldEmitSessionConflictEvent()) {
                return;
            }
            setConflictOriginalRequest(e.detail?.originalRequest ?? null);
            setIsSessionConflict(true);
        };
        window.addEventListener(API_SESSION_CONFLICT_EVENT, onApiSessionConflict);
        return () => window.removeEventListener(API_SESSION_CONFLICT_EVENT, onApiSessionConflict);
    }, []);

    useEffect(() => {
        if (error?.message?.toLowerCase()?.includes("fingerprint")) {
            setIsFingerprintError(true);
            return;
        }

        if (isErrorUserInformation) {
            const conflictCode = error?.response?.data?.data?.code;
            if (conflictCode !== AUTH_ERROR_SESSION_ACTIVE_ON_ANOTHER_DEVICE && !isSessionConflict) {
                setHasErrorAuth(true);
            }
            return;
        }

        if (!userInformation) return;

        if (typeof userInformation === "string" && userInformation.toUpperCase().includes("INACTIVE USER")) {
            setInactiveUser(true);
            return;
        }

        if (Object.keys(userInformation).length === 0) {
            setInactiveUser(true);
            return;
        }

        setisAuthenticated(true);
    }, [userInformation, isErrorUserInformation, error, isSessionConflict]);

    useEffect(() => {
        if (isAuthenticated && tokens && !isSessionConflict && !isSessionRejected) {
            commitAuthTokensToLocalStorage(tokens);
        }
    }, [isAuthenticated, tokens, isSessionConflict, isSessionRejected]);

    useEffect(() => {
        if (isAuthenticated) {
            processSchemaFields();
        }
    }, [isAuthenticated]);

    const logout = async (forceIndetityLogout = false) => {
        const userId = user.id ?? localStorage.getItem("userId") ?? null;
        try {
            await handlerLogout(userId);
        } catch {
            // NO-SONAR: No se captura el error para evitar interrumpir el flujo de la aplicación.
        } finally {
            localStorage.removeItem("tokens");
            localStorage.removeItem("userGroupId");
            localStorage.removeItem("sessionExpiration");
            localStorage.removeItem("userId");
            /*
             * Un logout forzado y re-login en la misma pestana no debe resucitar
             * los filtros de tabla del usuario anterior.
             */
            clearPersistedState();

            if (forceIndetityLogout) {
                armUnloadBypassForForcedSessionEnd();
            }
            window.location.href = forceIndetityLogout ? COGNITO_LOGOUT : "/auth";
        }
    };

    const onConfirmTakeover = useCallback(async () => {
        suppressSessionConflictEvents();
        await queryClient.cancelQueries({ queryKey: ["userInformation"] });
        try {
            const body = JSON.parse(conflictOriginalRequest?.data ?? "{}");
            const activeTokens = (await ensureValidAuthTokens()) ?? body;
            const response = await apiService.post(COGNITO_AUTHENTICATION, { ...activeTokens, force: true });
            const userData = mapAuthCognitoResponse(response);
            commitAuthTokensToLocalStorage(activeTokens);
            setTokens(activeTokens);
            await queryClient.fetchQuery({
                queryKey: ["userInformation"],
                queryFn: async () => userData,
                staleTime: 1000 * 60 * 60 * 23,
            });
            setIsSessionConflict(false);
            setConflictOriginalRequest(null);
            setHasErrorAuth(false);
        } catch {
            resetSessionConflictEventSuppression();
            setHasErrorAuth(true);
        }
    }, [conflictOriginalRequest, queryClient]);

    const onRejectTakeover = useCallback(async () => {
        suppressSessionConflictEvents();
        await queryClient.cancelQueries({ queryKey: ["userInformation"] });
        setIsSessionConflict(false);
        setConflictOriginalRequest(null);
        rejectPendingAuthSession();
        setTokens(null);
        setHasErrorAuth(false);
        setIsSessionRejected(true);
    }, [queryClient]);

    const dismissSessionRejected = useCallback(() => {
        sessionStorage.removeItem(SESSION_REJECTED_STORAGE_KEY);
        setIsSessionRejected(false);
        armUnloadBypassForForcedSessionEnd();
        window.location.href = COGNITO_LOGOUT;
    }, []);

    const authContextValue = useMemo(
        () => ({
            logout,
            userInformation,
            isLoadingUserInformation,
            isErrorUserInformation,
            refetch,
            isAuthenticated,
            hasErrorAuth,
            inactiveUser,
            isFingerprintError,
            fingerprint,
            isLoadingFingerprint,
            isSessionConflict,
            isSessionTakenOver,
            isSessionRejected,
            onConfirmTakeover,
            onRejectTakeover,
            dismissSessionRejected,
        }),
        [
            logout,
            userInformation,
            isLoadingUserInformation,
            isErrorUserInformation,
            refetch,
            isAuthenticated,
            hasErrorAuth,
            inactiveUser,
            isFingerprintError,
            fingerprint,
            isLoadingFingerprint,
            isSessionConflict,
            isSessionTakenOver,
            isSessionRejected,
            onConfirmTakeover,
            onRejectTakeover,
            dismissSessionRejected,
        ],
    );

    return <AuthContext.Provider value={authContextValue}>{children}</AuthContext.Provider>;
};

AuthProvider.propTypes = {
    children: PropTypes.node.isRequired,
};

export const useAuth = () => useContext(AuthContext);
