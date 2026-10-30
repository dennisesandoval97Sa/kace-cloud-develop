import { useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Label } from "@kace/ui-shared";
import SelectFromQuery from "@/componentsV2/lib/SelectFromQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { genericSearchService } from "@/services/genericSearchService";
import useConfigAgentData from "@/hooks/useConfigAgentData";
import { ACTIVE_SESSION_LIMIT_RANGE } from "@kace/core/src/global-config/domain/settings/behaviorNumericRanges.js";

const TEN_MINUTES_MS = 10 * 60 * 1000;
const envHeartBeatFrequency = parseInt(import.meta.env.VITE_SESSION_HEARTBEAT_FREQUENCY, 10);
const heartbeatFallback = isNaN(envHeartBeatFrequency) ? TEN_MINUTES_MS : envHeartBeatFrequency * 3;

const formatLastSeenAt = (date) => {
    const pad = (value, size = 2) => String(Math.abs(Math.trunc(value))).padStart(size, "0");
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    const millis = pad(date.getMilliseconds(), 3);
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absOffset = Math.abs(offsetMinutes);
    const offsetHours = pad(Math.floor(absOffset / 60));
    const offsetMins = pad(absOffset % 60);

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${millis} ${sign}${offsetHours}${offsetMins}`;
};

const GROUP_SEARCH_FILTER = [
    { field: "status", operator: "eq", value: 1, type: "AND" },
    { field: "deleted_at", operator: "null", value: "null", type: "AND" },
];

/**
 * Campos puros del formulario de reasignación (Grupo/Usuario), sin Formik/Form
 * propio, para poder reutilizarse tanto en el modal individual (ReAssignCase)
 * como en cada sección del modal combinado de acciones masivas.
 */
export const ReassignCaseFields = ({ errors, touched, values, setFieldValue }) => {
    const { t } = useTranslation();
    const { reassignFilterActiveUsers, reassignIncludeDefaultAssignees, active_session_limit } = useConfigAgentData();
    const sessionTimeframe =
        isNaN(active_session_limit) || active_session_limit < ACTIVE_SESSION_LIMIT_RANGE.min
            ? heartbeatFallback
            : active_session_limit * 1000 * 60;

    const lastSeenCutoff = useMemo(() => formatLastSeenAt(new Date(Date.now() - sessionTimeframe)), [sessionTimeframe]);

    const userSearchFilter = useMemo(() => {
        const baseFilters = [
            { field: "is_active", operator: "eq", value: "1", type: "AND" },
            { field: "deleted_at", operator: "null", value: "null", type: "AND" },
        ];

        if (!reassignFilterActiveUsers) return baseFilters;

        const activeFilter = { field: "last_seen_at", operator: "gte", value: lastSeenCutoff, type: "AND" };

        if (reassignIncludeDefaultAssignees) {
            return [
                ...baseFilters,
                {
                    groupType: "AND",
                    filters: [
                        { ...activeFilter, type: "AND" },
                        {
                            field: "codigos_externos",
                            operator: "jsonArrayValue",
                            value: "DEFAULT_ASSIGNEE",
                            type: "OR",
                        },
                    ],
                },
            ];
        }

        return [...baseFilters, activeFilter];
    }, [reassignFilterActiveUsers, reassignIncludeDefaultAssignees, lastSeenCutoff]);

    const formatUserLabel = useCallback(
        (user) => `${user.nombres} ${user.apellido1 ?? ""} ${user.apellido2 ?? ""}`.trim(),
        [],
    );

    const formatGroupLabel = useCallback((item) => item.grupo?.nombre ?? "", []);

    const handleUserSearch = useCallback(
        async (searchQuery) => {
            if (!searchQuery?.trim()) return [];
            try {
                const nameFilter = {
                    groupType: "OR",
                    filters: [
                        { field: "nombres", operator: "ilike", value: searchQuery, type: "OR" },
                        { field: "apellido1", operator: "ilike", value: searchQuery, type: "OR" },
                        { field: "apellido2", operator: "ilike", value: searchQuery, type: "OR" },
                    ],
                };
                const result = await genericSearchService(
                    `${URL_AND_KEYS.users.url}/search`,
                    [nameFilter, ...userSearchFilter],
                    { limit: 50, offset: 0 },
                );
                return (result.data || []).map((user) => ({
                    value: user.id,
                    label: formatUserLabel(user),
                }));
            } catch {
                return [];
            }
        },
        [formatUserLabel, userSearchFilter],
    );

    return (
        <div className="grid gap-4">
            <Label id="label_assignment_type" data-testid="label_assignment_type">
                {t("generalSetup.form.title.typeOfAssignment")}
            </Label>
            <Select
                onValueChange={(value) => {
                    setFieldValue("tipo", value);
                    setFieldValue("grupo_id", "");
                    setFieldValue("usuario_id", "");
                }}
                id="select_reassign_case"
                data-testid="reassign_case"
            >
                <SelectTrigger
                    className="w-full"
                    id="select_trigger_assignment_type"
                    data-testid="select_trigger_reassign_case"
                >
                    <SelectValue
                        placeholder={t("generalSetup.form.title.typeOfAssignment")}
                        id="select_value_reassign_case"
                        data-testid="select_value_reassign_case"
                    />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="1" id="select_item_group" data-testid="select_item_group">
                        {t("gridMain.columns.group")}
                    </SelectItem>
                    <SelectItem value="2" id="select_item_user" data-testid="select_item_user">
                        {t("notificationsAgent.form.user")}
                    </SelectItem>
                </SelectContent>
            </Select>
            {values.tipo === "2" && (
                <>
                    <SelectFromQuery
                        name="usuario_id"
                        value={values.usuario_id ?? ""}
                        setFieldValue={setFieldValue}
                        errorData={errors.usuario_id}
                        wasTouched={Boolean(touched.usuario_id || values.tipo)}
                        url={`${URL_AND_KEYS.users.url}/search`}
                        labelField="nombres"
                        formatLabel={formatUserLabel}
                        onSearch={handleUserSearch}
                        queryKey={["reassign-users"]}
                        filter={userSearchFilter}
                        noResultsMessage={t(
                            reassignFilterActiveUsers
                                ? "generalSetup.form.labels.reassignNoActiveUsers"
                                : "generalSetup.form.labels.reassignNoUsers",
                        )}
                        noSearchResultsMessage={t(
                            reassignFilterActiveUsers
                                ? "generalSetup.form.labels.reassignNoActiveUserFound"
                                : "generalSetup.form.labels.reassignNoUserFound",
                        )}
                        label={t("notificationsAgent.form.user")}
                    />
                    {values.usuario_id && (
                        <SelectFromQuery
                            name="grupo_id"
                            value={values.grupo_id ?? ""}
                            setFieldValue={setFieldValue}
                            errorData={errors.grupo_id}
                            wasTouched={Boolean(touched.grupo_id || values.tipo)}
                            url="user-group-relationships/search"
                            labelField="grupos.nombre"
                            formatLabel={formatGroupLabel}
                            valueField="grupo_id"
                            queryKey={["userRelated-groups", values.usuario_id]}
                            filter={[
                                { field: "usuario_id", operator: "eq", value: values.usuario_id, type: "AND" },
                                { field: "grupos.status", operator: "eq", value: 1, type: "AND" },
                            ]}
                            label={t("generalSetup.form.labels.userGroup")}
                            useDefault={false}
                            order={{ field: "grupo_id", direction: "asc" }}
                        />
                    )}
                </>
            )}
            {values.tipo === "1" && (
                <SelectFromQuery
                    name="grupo_id"
                    value={values.grupo_id ?? ""}
                    setFieldValue={setFieldValue}
                    errorData={errors.grupo_id}
                    wasTouched={Boolean(touched.grupo_id || values.tipo)}
                    url="/groups/search"
                    labelField="nombre"
                    queryKey={["groupsToUser"]}
                    label={t("gridMain.columns.group")}
                    filter={GROUP_SEARCH_FILTER}
                />
            )}
        </div>
    );
};

ReassignCaseFields.propTypes = {
    errors: PropTypes.object.isRequired,
    touched: PropTypes.object.isRequired,
    values: PropTypes.object.isRequired,
    setFieldValue: PropTypes.func.isRequired,
};
