import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PropTypes } from "prop-types";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { GeneralLoader, MenuBar } from "@kace/ui-shared";
import SideBar from "../core/SideBar/SideBar";
import { Toaster } from "sonner";
import { useSelector, useDispatch } from "react-redux";
import { TYPE_APPLICATION } from "@kace/utils";
import { SubMenuBar } from "./SubMenuBar";
import { useAuth } from "../../cognito-auth/AuthContext";
import useGeolocation from "../../hooks/useGeolocation";
import { GeolocationTypes } from "../../enums/GeolocationTypes";
import { setFilterCases } from "../../redux/state/filterCases";
import RouteResetHandler from "./RouteResetHandler";
import RouteErrorBoundary from "./RouteErrorBoundary";
import GroupConfiguration from "../../pages/GroupConfiguration/GroupConfiguration";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import MyAgenda from "../core/MyAgenda/MyAgenda";
import LogOutModal from "../modal/LogOutModal";
import useBannersInformation from "../../hooks/useBannersInformation";
import { ICONS_SELECT } from "../ui-shared/src/icons";
import useUserInformation from "../../hooks/useUserInformation";
import useSessionHeartbeat from "@/hooks/useSessionHeartbeat";
import useGroupMembershipValidation from "@/hooks/useGroupMembershipValidation";
import { subscribeGroupChanged, USER_GROUP_ID_KEY, shouldReloadForGroupSync } from "@/utils/groupSyncChannel";
import useConfigAgentData from "@/hooks/useConfigAgentData";
import useInactivityLogout from "@/hooks/useInactivityLogout";
import { ONESCRIPT_KONECTA_CLOUD } from "@/utils/URL";
import { clearPersistedState } from "@kace_v2/shared/utils/persistentStorage.util";

const BannerSlot = memo(function BannerSlot({
    show,
    place,
    iconName,
    color,
    message,
    animationDuration,
    fixed,
    whiteSpacePre,
    id,
    dataTestId,
}) {
    const IconComponent = useMemo(() => ICONS_SELECT.find((icon) => icon.name === iconName)?.component, [iconName]);
    if (!show || !place) return null;
    const messageStyle = {
        animation: `scroll-text ${animationDuration} linear infinite`,
        minWidth: "100%",
        display: "flex",
        gap: "8px",
    };
    if (whiteSpacePre) messageStyle.whiteSpace = "pre";

    return (
        <div
            className={fixed ? "info-bar fixed" : "info-bar"}
            style={{ backgroundColor: color }}
            id={id}
            data-testid={dataTestId}
        >
            <p style={messageStyle}>
                {IconComponent && (
                    <span>
                        <IconComponent className="h-5 w-5" />
                    </span>
                )}
                <span>{message}</span>
            </p>
        </div>
    );
});

BannerSlot.propTypes = {
    show: PropTypes.bool,
    place: PropTypes.bool,
    fixed: PropTypes.bool,
    whiteSpacePre: PropTypes.bool,
    color: PropTypes.string,
    message: PropTypes.string,
    iconName: PropTypes.string,
    animationDuration: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    id: PropTypes.string,
    dataTestId: PropTypes.string,
};

const API_FORCE_LOGOUT_EVENT = "kace:api-force-logout";

const MainLayout = () => {
    useSessionHeartbeat();
    useGroupMembershipValidation();
    const isLogoutInProgress = useRef(false);
    const { sessionTime } = useConfigAgentData();

    const { INACTIVITY_TIME, WARNING_LOGOUT_TIME } = useMemo(
        () => ({
            INACTIVITY_TIME: sessionTime?.inactivity_time ?? 30,
            WARNING_LOGOUT_TIME: sessionTime?.warning_logout_time ?? 5,
        }),
        [sessionTime],
    );

    const { logout } = useAuth();
    const [open, setOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const {
        animationDurationAbove,
        animationDurationBelow,
        currentBannerAbove,
        currentBannerBelow,
        showBannerAbove,
        showBannerBelow,
    } = useBannersInformation();

    const showBannerPlaceAbove = useMemo(
        () =>
            location.pathname.includes(`/${currentBannerAbove.place}`) ||
            currentBannerAbove.place === "both" ||
            (currentBannerAbove.place === "admin" && !location.pathname.includes("/agent")),
        [location?.pathname, currentBannerAbove?.place],
    );
    const showBannerPlaceBelow = useMemo(
        () =>
            location.pathname.includes(`/${currentBannerBelow.place}`) ||
            currentBannerBelow.place === "both" ||
            (currentBannerBelow.place === "admin" && !location.pathname.includes("/agent")),
        [location?.pathname, currentBannerAbove?.place],
    );

    const bannerHeight = useMemo(() => {
        if (!showBannerPlaceAbove && !showBannerPlaceBelow) return "4rem";
        if (showBannerPlaceAbove && showBannerAbove && showBannerPlaceBelow && showBannerBelow) return "7.5rem";
        if ((showBannerPlaceAbove && showBannerAbove) || (showBannerPlaceBelow && showBannerBelow)) return "5.8rem";
        return "4rem";
    }, [showBannerAbove, showBannerBelow, showBannerPlaceAbove, showBannerPlaceBelow]);

    const asideHeight = bannerHeight;

    const showGroupsSelect = useSelector((state) => state.showGroupsSelect.showGroupsSelect);
    /*
     * Lectura directa (sin useMemo): memoizar la lectura de localStorage dejaba
     * groupSelected obsoleto si el grupo se persistia sin cambiar showGroupsSelect/sessionTime.
     */
    const groupSelected =
        !showGroupsSelect &&
        Boolean(localStorage.getItem(USER_GROUP_ID_KEY)) &&
        sessionTime != null &&
        Number(sessionTime.inactivity_time) >= 1 &&
        Number(sessionTime.warning_logout_time) >= 0;
    const currentApplication = useSelector((state) => state.applicationSelected.currentApplication);
    const { handleGeolocation } = useGeolocation();
    const queryClient = useQueryClient();

    const { data: userCache } = useQuery({
        queryKey: ["userInformation"],
        queryFn: () => Promise.resolve(queryClient.getQueryData(["userInformation"]) ?? null),
        enabled: false,
        staleTime: Infinity,
    });
    const configAgent = useSelector((state) => state.generalSetup.configAgent);
    const { permissionsAdmin, permissionsAgent } = useUserInformation();
    const hasAccessAdmin = Boolean(permissionsAdmin?.find((p) => p.module_id === "access-admin")?.granted);
    const hasAccessAgent = Boolean(permissionsAgent?.find((p) => p.module_id === "access-agent")?.granted);
    const canAccessAdmin = configAgent != null && hasAccessAdmin;

    const handleChangeApplication = useCallback(() => {
        dispatch(setFilterCases(null));
        if (canAccessAdmin && hasAccessAgent) {
            navigate(location.pathname.startsWith("/agent") ? "/dashboard" : "/agent");
        } else if (canAccessAdmin) {
            navigate("/dashboard");
        } else if (hasAccessAgent) {
            navigate("/agent");
        } else {
            navigate("/access-control");
        }
    }, [canAccessAdmin, dispatch, hasAccessAdmin, hasAccessAgent, navigate, location.pathname]);

    const handleCurrentPosition = useCallback(async () => {
        const bihavior = GeolocationTypes.CURRENT_LOCATION;
        await handleGeolocation(bihavior.value);
    }, [handleGeolocation]);

    const handleLogout = useCallback(async () => {
        if (isLogoutInProgress.current) {
            return;
        }
        isLogoutInProgress.current = true;
        const behaviour = GeolocationTypes.LOGOUT;
        await handleGeolocation(behaviour.value, 0);
        await logout(true);
        sessionStorage.clear();
    }, [handleGeolocation, logout]);

    const { showModal, countdown, handleContinue, handleCloseModal } = useInactivityLogout({
        inactivityMinutes: INACTIVITY_TIME,
        warningMinutes: WARNING_LOGOUT_TIME,
        enabled: groupSelected,
        onLogout: handleLogout,
        onContinue: handleCurrentPosition,
        oneScriptOrigin: ONESCRIPT_KONECTA_CLOUD,
    });

    useEffect(() => {
        if (!sessionStorage.getItem("firstLogin")) {
            const bihavior = GeolocationTypes.LOGIN;
            sessionStorage.setItem("firstLogin", true);
            handleGeolocation(bihavior.value);
        }
    }, []);

    useEffect(() => {
        const handleApiForceLogout = async () => {
            await handleLogout();
        };
        window.addEventListener(API_FORCE_LOGOUT_EVENT, handleApiForceLogout);
        return () => window.removeEventListener(API_FORCE_LOGOUT_EVENT, handleApiForceLogout);
    }, [handleLogout]);

    useEffect(() => {
        const initialGroup = localStorage.getItem(USER_GROUP_ID_KEY);
        return subscribeGroupChanged((payload) => {
            const incoming = payload?.groupId ?? null;
            if (!shouldReloadForGroupSync(initialGroup, incoming)) return;
            /*
             * Las claves persistidas llevan el grupo, asi que el cambio ya deja
             * huerfano el estado anterior; el barrido solo evita que las claves
             * se acumulen sin limite en quien cambia de grupo a menudo.
             */
            clearPersistedState();
            window.location.reload();
        });
    }, []);

    return (
        <main className="min-h-screen grid grid-cols-3 sm:grid-cols-1 grid-rows-[auto,1fr] bg-backgroundContainer relative">
            <BannerSlot
                show={showBannerAbove}
                place={showBannerPlaceAbove}
                iconName={currentBannerAbove.icon}
                color={currentBannerAbove.color}
                message={currentBannerAbove.message}
                animationDuration={animationDurationAbove.current}
                fixed={true}
                whiteSpacePre={true}
            />
            <LogOutModal
                open={showModal}
                onClose={handleCloseModal}
                onContinue={handleContinue}
                countdown={countdown}
            />
            <MenuBar className="bg-background">
                <SubMenuBar
                    currentApplication={currentApplication}
                    handleChangeApp={handleChangeApplication}
                    handleCurrentPosition={handleCurrentPosition}
                    logOut={handleLogout}
                />
            </MenuBar>
            <section className="flex col-span-3 overflow-hidden">
                {currentApplication === TYPE_APPLICATION.ADMIN && !location.pathname.includes("/agent") && (
                    <aside
                        id="sideBar"
                        className={`transition-all ${open ? "w-80" : "w-16"} bg-gray-100`}
                        style={{
                            height: `calc(100vh - ${asideHeight})`,
                        }}
                    >
                        <SideBar setOpen={setOpen} open={open} />
                    </aside>
                )}

                <article
                    className="flex min-h-0 w-full flex-col overflow-hidden p-2"
                    style={{
                        height: `calc(100vh - ${bannerHeight})`,
                    }}
                >
                    <RouteResetHandler id="main_layout_router" data-testid="main_layout_router" />
                    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-auto">
                        <RouteErrorBoundary>
                            <Suspense fallback={<GeneralLoader />}>
                                <Outlet id="main_layout_outlet" data-testid="main_layout_outlet" />
                            </Suspense>
                        </RouteErrorBoundary>
                    </div>
                    <aside id="myAgenda" data-testid="main_layout_diary ">
                        <MyAgenda />
                    </aside>
                </article>
            </section>
            <BannerSlot
                show={showBannerBelow}
                place={showBannerPlaceBelow}
                iconName={currentBannerBelow.icon}
                color={currentBannerBelow.color}
                message={currentBannerBelow.message}
                animationDuration={animationDurationBelow.current}
                fixed={false}
                whiteSpacePre={false}
                id="main_layout_info_bar"
                dataTestId="main_layout_info_bar"
            />
            <div className="absolute">
                <Toaster richColors id="main_layout_toaster" data-testid="main_layout_toaster" />
            </div>
            {showGroupsSelect && <GroupConfiguration userInformation={userCache} />}
        </main>
    );
};

export default MainLayout;
