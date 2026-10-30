import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Copy, Boxes, Calendar, LogOut, MapPinned, SendToBack } from "lucide-react";
import { useTranslation } from "react-i18next";
import PropTypes from "prop-types";
import useUserInformation from "@kace/hooks/useUserInformation";
import { useDispatch, useSelector } from "react-redux";
import { setShowGroupsSelect } from "../../../../redux/state/showGroupSelect";
import { AnsUser } from "../../../core/AnsUser/AnsUser";
import { TYPE_APPLICATION } from "../../../../utils/main";
import { Helps } from "../../../core/Helps/Helps";
import { HighImpactCases } from "../../../core/HighImpactCases/HighImpactCases";
import { Separator } from "./ui/separator";
import { LogoLayoutContainer } from "../../../layouts/LogoLayoutContainer";
import ButtonIcon from "../../../core/ButtonIcon/ButtonIcon";
import { isMyAgendaVisible } from "../../../core/MyAgenda/myAgendaVisibility";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip.jsx";
import { toast } from "sonner";
import { useMemo } from "react";
import { formatUserFullName } from "@/utils/userDisplay";
export function PopoverMenuUser({
    logOut,
    handleChangeApp,
    handleCurrentPosition,
    configHeader,
    isHeaderLoaded,
    ansUser,
    currentApplication,
    helps,
    isLoading,
    currentGroup,
    setOpenedMyAgenda,
}) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const version = __APP_VERSION__;
    const { groups, user, permissionsAdmin, permissionsAgent } = useUserInformation();
    const configAgent = useSelector((state) => state.generalSetup.configAgent);
    const formatUserName = () => formatUserFullName(user);
    const copyExternalId = async () => {
        await navigator.clipboard.writeText(user.external_id);
        toast.info("External ID copiado al portapapeles");
    };
    const accessAdmin = useMemo(
        () => permissionsAdmin.filter((perm) => perm.module_id === "access-admin"),
        [permissionsAdmin],
    );
    const accessAgent = useMemo(
        () => permissionsAgent.filter((perm) => perm.module_id === "access-agent"),
        [permissionsAgent],
    );

    const validChangeApp = useMemo(() => {
        return (
            (currentApplication === TYPE_APPLICATION.ADMIN && accessAgent[0]?.granted) ||
            (currentApplication === TYPE_APPLICATION.AGENT && accessAdmin[0]?.granted)
        );
    }, [currentApplication, accessAdmin, accessAgent]);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger id="popover_menu_user_trigger" data-testid="popover_menu_user_trigger">
                <Avatar>
                    <AvatarImage />
                    <AvatarFallback>AD</AvatarFallback>
                </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent id="popover_menu_user_content" data-testid="popover_menu_user_content">
                <DropdownMenuItem
                    className="flex gap-2 items-center justify-center text-balance lg:hidden"
                    id="popover_menu_user_logo"
                    data-testid="popover_menu_user_logo"
                >
                    <LogoLayoutContainer configHeader={configHeader} currentGroup={currentGroup} />
                </DropdownMenuItem>
                <DropdownMenuSeparator className="flex lg:hidden" />
                <DropdownMenuItem
                    className="flex gap-2 items-center justify-around lg:hidden"
                    onSelect={(event) => {
                        event.preventDefault();
                    }}
                    id="popover_menu_user_shortcuts"
                    data-testid="popover_menu_user_shortcuts"
                >
                    {configHeader.total_cases_by_ans &&
                        (currentApplication === TYPE_APPLICATION.AGENT || location.pathname.includes("/agent")) && (
                            <>
                                <AnsUser contadores={ansUser} />
                                <Separator className="h-6 bg-muted" orientation="vertical" />
                            </>
                        )}
                    {configHeader.helps &&
                        (currentApplication === TYPE_APPLICATION.AGENT || location.pathname.includes("/agent")) && (
                            <>
                                <Helps helpsData={helps} isLoading={isLoading} />
                                <Separator className="h-6 bg-muted" orientation="vertical" />
                            </>
                        )}
                    {configHeader.high_impact_fields &&
                        (currentApplication === TYPE_APPLICATION.AGENT || location.pathname.includes("/agent")) && (
                            <>
                                <HighImpactCases />
                                <Separator className="h-6 bg-muted" orientation="vertical" />
                            </>
                        )}
                    {isMyAgendaVisible(configHeader, isHeaderLoaded) &&
                        (currentApplication === TYPE_APPLICATION.AGENT || location.pathname.includes("/agent")) && (
                            <div className="flex justify-start">
                                <ButtonIcon
                                    tooltip={t("diary.agenda.title")}
                                    onClick={() => setOpenedMyAgenda()}
                                    id="btn_menu_user_agenda"
                                    data-testid="btn_menu_user_agenda"
                                >
                                    <Calendar />
                                </ButtonIcon>
                            </div>
                        )}
                </DropdownMenuItem>
                <DropdownMenuSeparator
                    className="sm:hidden"
                    id="popover_menu_user_info"
                    data-testid="popover_menu_user_info"
                />
                <DropdownMenuLabel>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <p
                                    className="capitalize flex items-center gap-1 mb-2"
                                    id="popover_menu_user_name"
                                    data-testid="popover_menu_user_name"
                                >
                                    Nombre:
                                    <span className="font-normal w-52 block truncate overflow-hidden text-ellipsis whitespace-nowrap">
                                        {formatUserName()}
                                    </span>
                                </p>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="capitalize">{formatUserName()}</p>
                            </TooltipContent>
                        </Tooltip>

                        <div className="flex gap-1 mb-2">
                            <p
                                className="flex items-center gap-1"
                                id="popover_menu_user_external_id"
                                data-testid="popover_menu_user_external_id"
                            >
                                Id externo:
                                <span className="font-normal">{user?.external_id ?? "Sin datos"}</span>
                            </p>
                            {user?.external_id && (
                                <button
                                    onClick={() => copyExternalId()}
                                    id="btn_popover_menu_user_copy_id"
                                    data-testid="btn_popover_menu_user_copy_id"
                                >
                                    <Copy width={20} height={18} />
                                </button>
                            )}
                        </div>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <p
                                    className="flex items-center gap-1 mb-2"
                                    id="popover_menu_user_email"
                                    data-testid="popover_menu_user_email"
                                >
                                    Correo:
                                    <span className="font-normal w-52 block truncate overflow-hidden text-ellipsis whitespace-nowrap">
                                        {user.email}
                                    </span>
                                </p>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{user.email}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {validChangeApp && (
                    <DropdownMenuItem
                        onClick={() => {
                            if (handleChangeApp) handleChangeApp();
                        }}
                        className="flex gap-2"
                        id="btn_popover_menu_user_change_app"
                        data-testid="btn_popover_menu_user_change_app"
                    >
                        <SendToBack height={18} width={18} />
                        <p>Cambiar aplicación</p>
                    </DropdownMenuItem>
                )}
                {groups?.length > 1 && (
                    <DropdownMenuItem
                        onClick={() => {
                            dispatch(setShowGroupsSelect(true));
                            const lastGroup = localStorage.getItem("userGroupId");
                            localStorage.setItem("kace_last_group", lastGroup);
                            localStorage.removeItem("userGroupId");
                        }}
                        className="flex gap-2"
                        id="btn_popover_menu_user_change_group"
                        data-testid="btn_popover_menu_user_change_group"
                    >
                        <Boxes height={18} width={18} />
                        <p>Cambiar grupo</p>
                    </DropdownMenuItem>
                )}
                {configAgent.geolocation?.geolocation_current_location_bool && (
                    <DropdownMenuItem
                        onClick={() => {
                            if (handleCurrentPosition) handleCurrentPosition();
                        }}
                        className="flex gap-2"
                        id="btn_popover_menu_user_register_location"
                        data-testid="btn_popover_menu_user_register_location"
                    >
                        <MapPinned height={18} width={18} />
                        <p>{t("text.registerMyLocation")}</p>
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem
                    onClick={() => logOut(true)}
                    className="flex gap-2"
                    id="popover_menu_user_logout"
                    data-testid="popover_menu_user_logout"
                >
                    <LogOut height={18} width={18} />
                    <p>{t("text.logout")}</p>
                </DropdownMenuItem>
                <div
                    className="w-full flex justify-end"
                    id="popover_menu_user_version"
                    data-testid="popover_menu_user_version"
                >
                    <span className="text-xs text-gray-400 tracking-wider ml-4 opacity-70">v{version}</span>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

PopoverMenuUser.propTypes = {
    logOut: PropTypes.func,
    handleChangeApp: PropTypes.func,
    handleCurrentPosition: PropTypes.func,
    configHeader: PropTypes.object,
    isHeaderLoaded: PropTypes.bool,
    ansUser: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
    currentApplication: PropTypes.string,
    helps: PropTypes.array,
    isLoading: PropTypes.bool,
    currentGroup: PropTypes.object,
    setOpenedMyAgenda: PropTypes.func,
};
