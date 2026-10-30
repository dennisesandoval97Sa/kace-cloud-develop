import { Badge, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-shared";
import useRoleFormTabSearch from "./hooks/useRoleFormTabSearch";
import RoleFormTabSearchInput from "./components/RoleFormTabSearchInput";
import RoleFormTabSearchFilters from "./components/RoleFormTabSearchFilters";
import RoleFormTabSearchSelectAll from "./components/RoleFormTabSearchSelectAll";
import RoleFormTabSearchCard from "./components/RoleFormTabSearchCard";
import { useTranslation } from "react-i18next";

const RoleFormTabSearch = () => {
    const { t } = useTranslation();

    const {
        searchTerm,
        filterStatus,
        globalSelectAll,
        activeTab,
        availableRoles,
        initialRolesData,
        currentModules,
        handleModuleSelectAll,
        handlePermissionToggle,
        getFilteredModules,
        setActiveTab,
        handleGlobalSelectAll,
        setFilterStatus,
        setSearchTerm,
    } = useRoleFormTabSearch();

    return (
        <div className="p-6" id="role_form_tab_search" data-testid="role_form_tab_search">
            <div
                className="flex flex-col sm:flex-row gap-4 mb-6"
                id="role_form_tab_search_controls"
                data-testid="role_form_tab_search_controls"
            >
                <RoleFormTabSearchInput
                    value={searchTerm}
                    handler={setSearchTerm}
                    id="role_form_tab_search_input"
                    data-testid="role_form_tab_search_input"
                />
                <RoleFormTabSearchFilters
                    value={filterStatus}
                    handler={setFilterStatus}
                    id="role_form_tab_search_filters"
                    data-testid="role_form_tab_search_filters"
                />
                <RoleFormTabSearchSelectAll
                    isChecked={globalSelectAll}
                    handler={handleGlobalSelectAll}
                    id="role_form_tab_search_select_all"
                    data-testid="role_form_tab_search_select_all"
                />
            </div>

            <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                id="role_form_tab_tabs"
                data-testid="role_form_tab_tabs"
            >
                <TabsList
                    className="grid w-full mb-6"
                    style={{ gridTemplateColumns: `repeat(${availableRoles.length}, minmax(0, 1fr))` }}
                    id="role_form_tab_list"
                    data-testid="role_form_tab_list"
                >
                    {availableRoles.map(({ role, label }) => (
                        <TabsTrigger
                            key={role}
                            value={role}
                            className="relative capitalize"
                            id={`role_form_tab_trigger_${label}`}
                            data-testid={`role_form_tab_trigger_${label}`}
                        >
                            {t(`rol.form.title.${label}`, label)}
                            <Badge
                                variant="outline"
                                className="ml-2 text-xs bg-slate-400/40 border-slate-400/40"
                                id={`role_form_tab_badge_${role}`}
                                data-testid={`role_form_tab_badge_${role}`}
                            >
                                {(initialRolesData[role] ?? []).filter((p) => p.granted).length}
                            </Badge>
                        </TabsTrigger>
                    ))}
                </TabsList>

                {availableRoles.map(({ role }) => (
                    <TabsContent
                        key={role}
                        value={role}
                        id={`role_form_tab_content_${role}`}
                        data-testid={`role_form_tab_content_${role}`}
                    >
                        <div
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                            id={`role_form_tab_modules_${role}`}
                            data-testid={`role_form_tab_modules_${role}`}
                        >
                            {getFilteredModules(currentModules).map((module) => (
                                <RoleFormTabSearchCard
                                    key={module.id}
                                    module={module}
                                    handleModuleSelectAll={handleModuleSelectAll}
                                    handlePermissionToggle={handlePermissionToggle}
                                />
                            ))}
                        </div>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
};

export default RoleFormTabSearch;
