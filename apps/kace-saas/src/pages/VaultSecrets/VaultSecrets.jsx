import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import VaultSecretsHandler from "./VaultSecretsHandler"

const VaultSecrets = () => {
    return (
        <DashboardSectionCard title={"app.title.secretsVaults"}>
            <VaultSecretsHandler />
        </DashboardSectionCard>
    )
}

export default VaultSecrets
