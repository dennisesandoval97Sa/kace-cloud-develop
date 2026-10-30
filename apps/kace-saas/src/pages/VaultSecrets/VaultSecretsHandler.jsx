import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions";
import VaultSecretsTableContainer from "./VaultSecretsTableContainer";
import useVaultSecretsActions from "./hooks/useVaultSecretsActions";
import VaultSecretsForm from "./components/VaultSecretsForm";
import usePermissionsUser from "../../hooks/usePermissionsUser";
import { useTranslation } from "react-i18next";

const VaultSecretsHandler = () => {
    const { t } = useTranslation();
    const { handleDeleteSecretVault, handleUpdateSecretVault, handleSeeSecretVault } = useVaultSecretsActions();

    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "secrets-vault",
        actions: [
            { name: "SecretsVaultUpdate", label: "Editar", handler: handleUpdateSecretVault },
            { name: "SecretsVaultDelete", label: `${t("app.forms.delete")}`, handler: handleDeleteSecretVault },
            { name: "SecretsVaultsRead", label: `${t("app.forms.see")}`, handler: handleSeeSecretVault },
        ],
        nameCreate: "SecretsVaultCreate",
    });

    return (
        <div className="flex flex-col gap-4">
            {canBeCreate && <DefaultIndexActions buttonModal={<VaultSecretsForm />} nameDataTestId="vault_secrets" />}
            <VaultSecretsTableContainer arrayAction={arrayAction} />
        </div>
    );
};

export default VaultSecretsHandler;
