import { useMemo } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import SelectField from "@kace_v2/shared/ui/molecules/SelectField";
import useConfigAgentData from "@kace/hooks/useConfigAgentData";
import useGroupsOptions from "@kace_v2/shared/hooks/useGroupsOptions.hook";
import useBoardBulkAssignableUsersOptions from "@kace_v2/features/boards/hooks/useBoardBulkAssignableUsersOptions.hook";
import useBoardBulkUserGroupsOptions from "@kace_v2/features/boards/hooks/useBoardBulkUserGroupsOptions.hook";
import { ACTIVE_SESSION_LIMIT_RANGE } from "@kace/core/src/global-config/domain/settings/behaviorNumericRanges.js";

const TEN_MINUTES_MS = 10 * 60 * 1000;

/**
 * Campos puros de asignación masiva (Grupo/Usuario), sin Formik/Form propio,
 * reutilizados tanto por el modal individual como por la sección "Reasignar"
 * del modal combinado de acciones masivas.
 */
export const BoardCasesBulkAssignFields = ({ errors, values, setFieldValue }) => {
    const { t } = useTranslation();
    const tipoOptions = useMemo(
        () => [
            { label: t("boards.bulkActions.assignModal.typeGroup"), value: "1" },
            { label: t("boards.bulkActions.assignModal.typeUser"), value: "2" },
        ],
        [t],
    );
    const { reassignFilterActiveUsers, reassignIncludeDefaultAssignees, active_session_limit } = useConfigAgentData();
    const envHeartBeatFrequency = parseInt(import.meta.env.VITE_SESSION_HEARTBEAT_FREQUENCY, 10);
    const heartbeatFallback = Number.isNaN(envHeartBeatFrequency) ? TEN_MINUTES_MS : envHeartBeatFrequency * 3;
    const sessionTimeframe =
        Number.isNaN(active_session_limit) || active_session_limit < ACTIVE_SESSION_LIMIT_RANGE.min
            ? heartbeatFallback
            : active_session_limit * 1000 * 60;

    const groupsSelectable = useGroupsOptions([], 100, { enabled: values.tipo === "1" });
    const usersSelectable = useBoardBulkAssignableUsersOptions({
        enabled: values.tipo === "2",
        reassignFilterActive: reassignFilterActiveUsers,
        includeDefaultAssignees: reassignIncludeDefaultAssignees,
        sessionTimeframe,
    });
    const userGroupsSelectable = useBoardBulkUserGroupsOptions(
        values.usuario_id,
        values.tipo === "2" && Boolean(values.usuario_id),
    );

    return (
        <div className="grid gap-4">
            <SelectField
                label={t("boards.bulkActions.assignModal.assignmentType")}
                placeholder={t("boards.bulkActions.assignModal.selectTypePlaceholder")}
                options={tipoOptions}
                defaultValue={values.tipo || ""}
                value={values.tipo || ""}
                error={errors.tipo}
                onValueChange={(value) => {
                    setFieldValue("tipo", value);
                    setFieldValue("usuario_id", "");
                    setFieldValue("grupo_id", "");
                }}
            />
            {values.tipo === "2" && (
                <>
                    <SelectField
                        label={t("boards.bulkActions.assignModal.user")}
                        placeholder={t("boards.bulkActions.assignModal.selectUserPlaceholder")}
                        options={usersSelectable.usersOptions}
                        isLoading={usersSelectable.isLoading}
                        fetchNextPage={usersSelectable.fetchNextPage}
                        hasNextPage={usersSelectable.hasNextPage}
                        isFetchingNextPage={usersSelectable.isFetchingNextPage}
                        onSearch={usersSelectable.onSearch}
                        defaultValue={values.usuario_id ? String(values.usuario_id) : ""}
                        value={values.usuario_id ? String(values.usuario_id) : ""}
                        error={errors.usuario_id}
                        onValueChange={(value) => {
                            setFieldValue("usuario_id", value);
                            setFieldValue("grupo_id", "");
                        }}
                    />
                    {values.usuario_id ? (
                        <SelectField
                            label={t("boards.bulkActions.assignModal.userGroups")}
                            placeholder={t("boards.bulkActions.assignModal.selectGroupPlaceholder")}
                            options={userGroupsSelectable.groupsOptions}
                            isLoading={userGroupsSelectable.isLoading}
                            fetchNextPage={userGroupsSelectable.fetchNextPage}
                            hasNextPage={userGroupsSelectable.hasNextPage}
                            isFetchingNextPage={userGroupsSelectable.isFetchingNextPage}
                            defaultValue={values.grupo_id ? String(values.grupo_id) : ""}
                            value={values.grupo_id ? String(values.grupo_id) : ""}
                            error={errors.grupo_id}
                            onValueChange={(value) => setFieldValue("grupo_id", value)}
                        />
                    ) : null}
                </>
            )}
            {values.tipo === "1" ? (
                <SelectField
                    label={t("boards.bulkActions.assignModal.group")}
                    placeholder={t("boards.bulkActions.assignModal.selectGroupPlaceholder")}
                    options={groupsSelectable.groupsOptions}
                    isLoading={groupsSelectable.isLoading}
                    fetchNextPage={groupsSelectable.fetchNextPage}
                    hasNextPage={groupsSelectable.hasNextPage}
                    isFetchingNextPage={groupsSelectable.isFetchingNextPage}
                    onSearch={groupsSelectable.onSearch}
                    defaultValue={values.grupo_id ? String(values.grupo_id) : ""}
                    value={values.grupo_id ? String(values.grupo_id) : ""}
                    error={errors.grupo_id}
                    onValueChange={(value) => setFieldValue("grupo_id", value)}
                />
            ) : null}
        </div>
    );
};

BoardCasesBulkAssignFields.propTypes = {
    errors: PropTypes.object.isRequired,
    values: PropTypes.object.isRequired,
    setFieldValue: PropTypes.func.isRequired,
};
