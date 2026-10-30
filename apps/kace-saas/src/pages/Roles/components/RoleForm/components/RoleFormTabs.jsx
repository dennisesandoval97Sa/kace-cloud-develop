import { Checkbox, Tabs, TabsList, TabsTrigger } from "@/components/ui-shared";
import { TabsContent } from "@radix-ui/react-tabs";
import { useTranslation } from "react-i18next";
import RoleFormPermissionsSelector from "./RoleFormPermissionsSelector";
import { Label } from "@/componentsV2/core/Label";
import useRoleFormPermissionsHandler from "../hooks/useRoleFormPermissionsHandler";

const RoleFormTabs = () => {
    const { t } = useTranslation();
    const {
        auxPermissions,
        agentPermissions,
        adminPermissions,
        areAllGlobalChecked,
        handlePermissionChange,
        handleToggleAllGlobal,
        handleToggleAllInRole,
    } = useRoleFormPermissionsHandler();

    return (
        <Tabs defaultValue="agent" className="w-full flex flex-col gap-4">
            <TabsList>
                <TabsTrigger value="agent" id="role_form_tabs_agent" data-testid="role_form_tabs_agent">{t("rol.form.title.agent")}</TabsTrigger>
                <TabsTrigger value="admin" id="role_form_tabs_admin" data-testid="role_form_tabs_admin">{t("rol.form.title.admin")}</TabsTrigger>
                {Object.entries(auxPermissions).length > 0 && (
                    <TabsTrigger value="aux" id="role_form_tabs_aux" data-testid="role_form_tabs_aux">{t("rol.form.title.auxiliaries")}</TabsTrigger>
                )}
            </TabsList>
            <div className="flex items-center gap-3 cursor-pointer pb-4 mb-4 border-b-2">
                <Checkbox
                    id="toggle-all-global"
                    checked={areAllGlobalChecked}
                    onCheckedChange={handleToggleAllGlobal}
                    data-testid="role_toggle_all_global"
                />
                <Label htmlFor="toggle-all-global" className="text-lg font-bold">
                    {t("rol.form.labels.selectAllRoles")}
                </Label>
            </div>
            <TabsContent value="agent" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(agentPermissions).map(([roleName, values]) => (
                    <RoleFormPermissionsSelector
                        key={roleName}
                        module="agente"
                        roleName={roleName}
                        permissions={values}
                        onPermissionChange={handlePermissionChange}
                        onToggleAllInRole={handleToggleAllInRole}
                    />
                ))}
            </TabsContent>
            <TabsContent value="admin" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(adminPermissions).map(([roleName, values]) => (
                    <RoleFormPermissionsSelector
                        key={roleName}
                        module="administrador"
                        roleName={roleName}
                        permissions={values}
                        onPermissionChange={handlePermissionChange}
                        onToggleAllInRole={handleToggleAllInRole}
                    />
                ))}
            </TabsContent>
            <TabsContent value="aux" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(auxPermissions).map(([roleName, values]) => (
                    <RoleFormPermissionsSelector
                        key={roleName}
                        module="auxiliaries"
                        roleName={roleName}
                        permissions={values}
                        onPermissionChange={handlePermissionChange}
                        onToggleAllInRole={handleToggleAllInRole}
                    />
                ))}
            </TabsContent>
        </Tabs>
    );
};

export default RoleFormTabs;
