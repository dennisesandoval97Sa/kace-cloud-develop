import useLiteralHook from "./hooks/useLiteralHook"
import { ListFilter } from "lucide-react"
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import CardLiterals from "./components/CardLiterals"
import CardFields from "./components/CardFields"
import CardOptions from "./components/CardOptions"
import { useTranslation } from "react-i18next"
import { GeneralLoader } from "@kace/ui-shared"
import { LiteralProvider } from "./LiteralContext"

const ModelsHandler = () => {
    const { t } = useTranslation()
    const {
        literals,
        isLoadingData,
        handleDeleteModel,
        selected,
        onChangeSelected
    } = useLiteralHook()

    const isEmpty = literals.length === 0

    if (isLoadingData) {
        return <GeneralLoader />
    }

    return (
        <DashboardSectionCard title={"app.title.literal"}>
            <div className="flex justify-center items-center gap-8 py-4">
                {isEmpty
                    ? (
                        <div className="flex flex-col gap-4 justify-center items-center">
                            <ListFilter className="w-20 h-20 text-gray-500" />
                            <span className="text-gray-500">
                                {t("app.text.noModels")}
                            </span>
                        </div>
                    )
                    : (
                        <div className="flex flex-wrap gap-4">
                            <LiteralProvider>
                                <CardLiterals
                                    literals={literals}
                                    handleDeleteModel={handleDeleteModel}
                                    onChangeSelected={onChangeSelected}
                                    selectedLiteral={selected}
                                />
                                <CardFields
                                    onChangeSelected={onChangeSelected}
                                    selected={selected}
                                />
                                <CardOptions selected={selected}/>
                            </LiteralProvider>
                        </div>
                    )}
            </div>
        </DashboardSectionCard>
    )
}

export default ModelsHandler
