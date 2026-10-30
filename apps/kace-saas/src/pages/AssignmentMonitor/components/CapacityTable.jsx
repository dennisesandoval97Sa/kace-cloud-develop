import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

const hasNoCapacity = (group) => group.users_with_capacity === 0 || group.capacidad === 0;

// Disponibles (con sesión/filtros OK) a los que no les queda cupo.
const availableWithoutCapacity = (group) =>
    Number.isFinite(group.users_available) && Number.isFinite(group.users_with_capacity)
        ? Math.max(0, group.users_available - group.users_with_capacity)
        : null;

const groupName = (group) => group.nombre ?? group.grupo_id;

const COLUMNS = [
    {
        key: "name",
        labelKey: "assignmentMonitor.detail.group",
        value: (group) => String(groupName(group)).toLowerCase(),
    },
    {
        key: "users_total",
        labelKey: "assignmentMonitor.detail.usersTotal",
        tooltipKey: "assignmentMonitor.tooltips.usersTotal",
        value: (group) => group.users_total,
    },
    {
        key: "users_with_capacity",
        labelKey: "assignmentMonitor.detail.usersWithCapacity",
        tooltipKey: "assignmentMonitor.tooltips.usersWithCapacity",
        value: (group) => group.users_with_capacity,
    },
    {
        key: "available_without_capacity",
        labelKey: "assignmentMonitor.detail.usersAvailableWithoutCapacity",
        tooltipKey: "assignmentMonitor.tooltips.availableWithoutCapacity",
        value: availableWithoutCapacity,
    },
    {
        key: "capacidad",
        labelKey: "assignmentMonitor.detail.slots",
        tooltipKey: "assignmentMonitor.tooltips.slots",
        value: (group) => group.capacidad,
    },
    {
        key: "max_cases_per_user",
        labelKey: "assignmentMonitor.detail.maxCasesPerUser",
        tooltipKey: "assignmentMonitor.tooltips.maxCasesPerUser",
        value: (group) => group.max_cases_per_user,
    },
    {
        key: "assigned",
        labelKey: "assignmentMonitor.detail.assignedInRun",
        tooltipKey: "assignmentMonitor.tooltips.assignedInRun",
        value: (group) => group.assigned,
    },
];

const CapacityTable = ({ groups }) => {
    const { t } = useTranslation();
    const [nameFilter, setNameFilter] = useState("");
    const [sort, setSort] = useState(null);
    const [expandedGroups, setExpandedGroups] = useState(() => new Set());

    const toggleExpanded = (groupId) => {
        setExpandedGroups((current) => {
            const next = new Set(current);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    };

    const toggleSort = (key) => {
        setSort((current) =>
            current?.key === key
                ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
                : { key, direction: "asc" },
        );
    };

    const visibleGroups = useMemo(() => {
        const needle = nameFilter.trim().toLowerCase();
        const rows = needle
            ? groups.filter((group) => String(groupName(group)).toLowerCase().includes(needle))
            : [...groups];
        if (!sort) return rows;

        const column = COLUMNS.find((candidate) => candidate.key === sort.key);
        const direction = sort.direction === "asc" ? 1 : -1;
        return rows.sort((a, b) => {
            const valueA = column.value(a);
            const valueB = column.value(b);
            // Sin dato (grupos no-work-queue) siempre al final, sin importar la dirección.
            if (valueA === null || valueA === undefined) return valueB === null || valueB === undefined ? 0 : 1;
            if (valueB === null || valueB === undefined) return -1;
            if (valueA < valueB) return -direction;
            if (valueA > valueB) return direction;
            return 0;
        });
    }, [groups, nameFilter, sort]);

    return (
        <div>
            <input
                type="text"
                className="border border-input rounded-md p-1 mb-2 w-72 max-w-full"
                placeholder={t("assignmentMonitor.detail.filterByGroup")}
                value={nameFilter}
                data-testid="capacity_group_filter"
                onChange={(event) => setNameFilter(event.target.value)}
            />
            <div className="max-h-[60vh] overflow-auto">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-white">
                        <tr className="text-left border-b">
                            {COLUMNS.map((column) => (
                                <th key={column.key} className="p-2 bg-white">
                                    <button
                                        type="button"
                                        className="flex items-center gap-1 font-bold"
                                        title={column.tooltipKey ? t(column.tooltipKey) : undefined}
                                        data-testid={`sort_${column.key}`}
                                        onClick={() => toggleSort(column.key)}
                                    >
                                        {t(column.labelKey)}
                                        {sort?.key === column.key && (sort.direction === "asc" ? " ▲" : " ▼")}
                                    </button>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {visibleGroups.map((group) => {
                            const availableUsers = group.available_users ?? [];
                            const isExpanded = expandedGroups.has(group.grupo_id);
                            return [
                                <tr
                                    key={group.grupo_id}
                                    className={hasNoCapacity(group) ? "border-b bg-red-50" : "border-b"}
                                    data-testid={hasNoCapacity(group) ? "group-no-capacity" : undefined}
                                >
                                    <td className="p-2">
                                        {availableUsers.length > 0 && (
                                            <button
                                                type="button"
                                                className="mr-2 font-bold"
                                                title={t("assignmentMonitor.detail.showAvailableUsers")}
                                                data-testid={`toggle_users_${group.grupo_id}`}
                                                onClick={() => toggleExpanded(group.grupo_id)}
                                            >
                                                {isExpanded ? "▾" : "▸"}
                                            </button>
                                        )}
                                        {groupName(group)}
                                    </td>
                                    <td className="p-2">{group.users_total ?? "-"}</td>
                                    <td className="p-2">{group.users_with_capacity ?? "-"}</td>
                                    <td className="p-2" data-testid={`available-no-capacity-${group.grupo_id}`}>
                                        {availableWithoutCapacity(group) ?? "-"}
                                    </td>
                                    <td className="p-2">
                                        {group.capacidad ?? "∞"}
                                        {hasNoCapacity(group) && (
                                            <span className="ml-2 text-red-700 font-semibold">
                                                {t("assignmentMonitor.detail.noCapacity")}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-2">{group.max_cases_per_user ?? "-"}</td>
                                    <td className="p-2">{group.assigned}</td>
                                </tr>,
                                isExpanded && (
                                    <tr key={`${group.grupo_id}-users`} data-testid={`users_row_${group.grupo_id}`}>
                                        <td colSpan={COLUMNS.length} className="p-2 pl-8 bg-gray-50 border-b">
                                            <div className="flex flex-wrap gap-2">
                                                {availableUsers.map((user) => (
                                                    <span
                                                        key={user.usuario_id}
                                                        className={
                                                            user.with_capacity
                                                                ? "px-2 py-1 rounded-full text-xs bg-emerald-50 text-emerald-800"
                                                                : "px-2 py-1 rounded-full text-xs bg-red-50 text-red-800"
                                                        }
                                                    >
                                                        {user.nombre ?? user.usuario_id}
                                                        {" · "}
                                                        {user.with_capacity
                                                            ? t("assignmentMonitor.detail.userWithSlot")
                                                            : t("assignmentMonitor.detail.noCapacity")}
                                                    </span>
                                                ))}
                                            </div>
                                            {group.available_users_truncated && (
                                                <p className="mt-1 text-xs text-gray-500">
                                                    {t("assignmentMonitor.detail.availableUsersTruncated")}
                                                </p>
                                            )}
                                        </td>
                                    </tr>
                                ),
                            ];
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

CapacityTable.propTypes = {
    groups: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default CapacityTable;
