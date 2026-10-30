import { Button, Card, CardHeader, CardDescription, CardTitle, CardContent, CardFooter } from "@kace/ui-shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import PropTypes from "prop-types";
import { Form, Formik } from "formik";
import { Select } from "@/components/ui-shared/src/components/Select/Select";
import { GENERAL_SETUP_SERVICE, joiFormikAdapter, TYPE_APPLICATION, apiService } from "../../utils/main";
import { GroupSelectUserSchema } from "../../schemas/GroupSelectUser";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDispatch } from "react-redux";
import { GROUP_SERVICE, USER_SERVICE } from "../../utils/URL";
import { genericView } from "../../services/genericView";
import { setGeneralSetupAdmin, setGeneralSetupAgent, setConfigId } from "../../redux/state/generalSetupSlice";
import LoadingPage from "../../components/core/LoaderPage/LoginLoaderPage";
import { GeneralErrorPage } from "../../components/core/ErrorPage/GeneralErrorPage";
import { useAuth } from "../../cognito-auth/AuthContext";
import { setGroupInformation } from "../../redux/state/groupInformation";
import { setShowGroupsSelect } from "../../redux/state/showGroupSelect";
import { setInputSearchFilter } from "../../redux/state/states";
import { setIsNew } from "../../redux/state/client";
import { setApplicationSelected } from "../../redux/state/applicationSelectedSlice";
import { broadcastGroupChanged } from "../../utils/groupSyncChannel";
import { buildGroupSelectOptions } from "./groupSelectOptions";

const GroupConfiguration = ({ userInformation = {} }) => {
    const { t } = useTranslation();
    const [oneGroup, setOneGroup] = useState(false);
    const [idGroup, setIdGroup] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const dispatch = useDispatch();
    const queryClient = useQueryClient();
    const groupIdLocal = localStorage.getItem("userGroupId");
    const [submitting, setSubmitting] = useState(false);
    const groupOptions = useMemo(
        () => buildGroupSelectOptions(userInformation.groups, searchTerm),
        [userInformation.groups, searchTerm],
    );

    const { logout } = useAuth();

    const { data: userGroup = [], isLoading: isLoadingUser } = useQuery({
        queryKey: ["userGroup", idGroup],
        queryFn: async () => {
            const response = await genericView(`${GROUP_SERVICE}/${idGroup}`);
            return [response.data.configuration_id];
        },
        enabled: !!idGroup,
        staleTime: 0,
        gcTime: 0,
    });

    const globalConfigData = useQueries({
        queries: userGroup.map((item) => ({
            queryKey: ["globalConfigurations", item],
            queryFn: async () => {
                const response = await genericView(`${GENERAL_SETUP_SERVICE}/${item}`);
                return response;
            },
            staleTime: 0,
            gcTime: 0,
        })),
    });

    useEffect(() => {
        if (globalConfigData[0]?.data) {
            const currentApplication = location.pathname.includes("/agent")
                ? TYPE_APPLICATION.AGENT
                : TYPE_APPLICATION.ADMIN;
            const { behaviors, layouts } = globalConfigData[0].data.settings;
            const configAgentBehaviors = behaviors.application.agente;
            const configAgentLayouts = layouts.application.agente;
            const AgentNameFields = layouts.application.admin;
            const configAgent = {
                ...configAgentBehaviors,
                ...configAgentLayouts,
                AgentNameFields,
            };
            const configAdminBehaviors = behaviors.application.admin;
            const configAdminLayouts = layouts.application.admin;
            const configAdmin = {
                ...configAdminBehaviors,
                ...configAdminLayouts,
            };

            const idConfig = globalConfigData[0]?.data.id;

            dispatch(setConfigId(idConfig));
            dispatch(setGeneralSetupAdmin(configAdmin));
            dispatch(setGeneralSetupAgent(configAgent));
            dispatch(setInputSearchFilter());
            dispatch(setApplicationSelected(currentApplication));
            dispatch(setShowGroupsSelect(false));
        }
    }, [globalConfigData]);

    const handleSendInformation = useCallback(
        async (value) => {
            queryClient.setQueryData(["userInformation"], () => {
                return {
                    ...userInformation,
                    user: {
                        ...userInformation.user,
                        selectedGroup: value,
                    },
                };
            });
            localStorage.setItem("userGroupId", value);
            broadcastGroupChanged(value);
            setIdGroup(value);
            dispatch(setIsNew(true));
        },
        [idGroup],
    );

    useEffect(() => {
        if (groupIdLocal) {
            queryClient.setQueryData(["userInformation"], () => {
                return {
                    ...userInformation,
                    user: {
                        ...userInformation.user,
                        selectedGroup: groupIdLocal,
                    },
                };
            });
            setIdGroup(groupIdLocal);
            return;
        }
        if (userInformation.groups.length === 1) {
            setOneGroup(true);
            apiService.post(`${USER_SERVICE}/update-active-group`, {
                grupo_activo: userInformation.groups[0].id,
            });
            handleSendInformation(userInformation.groups[0].id);
            dispatch(setGroupInformation(userInformation.groups[0]));
        } else {
            setOneGroup(false);
        }
    }, [userInformation]);

    if (groupIdLocal || oneGroup) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-background bg-opacity-100 z-50 animate-fadeIn">
                <LoadingPage message={t("channelHub.groupConfiguration.loadingGroup")} className="" />
            </div>
        );
    }

    if (isLoadingUser || globalConfigData[0]?.isLoading) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-background bg-opacity-100 z-50 animate-fadeIn">
                <LoadingPage message={t("channelHub.groupConfiguration.loadingConfig")} className="" />
            </div>
        );
    }

    if (userInformation.groups.length === 0) {
        return (
            <div className="fixed inset-0 z-50 animate-fadeIn">
                <GeneralErrorPage refetch={logout} message={t("channelHub.groupConfiguration.noGroupsAssigned")} />
            </div>
        );
    }

    return (
        <Formik
            enableReinitialize={true}
            initialValues={{ idGroup: idGroup ?? "" }}
            validationSchema={joiFormikAdapter(GroupSelectUserSchema)}
            onSubmit={async (values) => {
                setSubmitting(true);
                await apiService.post(`${USER_SERVICE}/update-active-group`, { grupo_activo: values.idGroup });
                handleSendInformation(values.idGroup);
                const lastURL = localStorage.getItem("lastURL");
                localStorage.removeItem("lastURL");
                setSubmitting(false);
                if (lastURL) {
                    window.location.replace(lastURL);
                } else {
                    const currentApplication = window.location.pathname;
                    window.location.replace(currentApplication.includes("/agent") ? "/agent" : currentApplication);
                }
            }}
        >
            {({ values }) => (
                <div
                    className="flex flex-col items-center justify-center h-screen w-screen bg-background absolute top-0 right-0 z-50"
                    id="group_configuration_container"
                    data-testid="group_configuration_container"
                >
                    <Card
                        className="w-[350px] bg-backgroundContainer shadow-md"
                        id="group_configuration_card"
                        data-testid="group_configuration_card"
                    >
                        <CardHeader>
                            <CardTitle id="group_configuration_title" data-testid="group_configuration_title">
                                {t("channelHub.groupConfiguration.title")}
                            </CardTitle>
                            <CardDescription
                                id="group_configuration_description"
                                data-testid="group_configuration_description"
                            >
                                {t("channelHub.groupConfiguration.description")}
                            </CardDescription>
                        </CardHeader>
                        <Form autoComplete="off">
                            <CardContent id="group_configuration_content" data-testid="group_configuration_content">
                                <div className="grid w-full items-center gap-4">
                                    <div className="flex flex-col space-y-1.5">
                                        <Select
                                            name="idGroup"
                                            id="group_configuration"
                                            label={t("channelHub.groupConfiguration.label")}
                                            placeholder={t("channelHub.groupConfiguration.placeholder")}
                                            options={groupOptions}
                                            onSearchChange={setSearchTerm}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter
                                className="flex justify-center"
                                id="group_configuration_footer"
                                data-testid="group_configuration_footer"
                            >
                                <Button
                                    type="submit"
                                    disabled={
                                        !values.idGroup || isLoadingUser || globalConfigData[0]?.isLoading || submitting
                                    }
                                    id="btn_group_configuration_submit"
                                    data-testid="btn_group_configuration_submit"
                                >
                                    {isLoadingUser || globalConfigData[0]?.isLoading
                                        ? t("channelHub.groupConfiguration.loading")
                                        : t("channelHub.groupConfiguration.submit")}
                                </Button>
                            </CardFooter>
                        </Form>
                    </Card>
                </div>
            )}
        </Formik>
    );
};

GroupConfiguration.propTypes = {
    userInformation: PropTypes.object.isRequired,
};

export default GroupConfiguration;
