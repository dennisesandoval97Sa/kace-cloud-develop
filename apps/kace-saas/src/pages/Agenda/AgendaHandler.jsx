import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions"
import AgendaForm from "./components/AgendaForm"
import { AgendaTableContainer } from "./components/AgendaTableContainer"
import useActionsAgenda from "./hooks/useActionsAgenda"
import { useAgendaUpdate } from "./hooks/useAgendaUpdate"

const AgendaHandler = () => {
    const { arrayAction, canBeCreate } = useActionsAgenda()
    const { handleAgendaUpdate } = useAgendaUpdate()

    return (
        <div className="flex flex-col gap-4">
            {canBeCreate && <DefaultIndexActions
                buttonModal={
                    <AgendaForm
                        dataHandler={handleAgendaUpdate}
                    />
                }
            />}
            <AgendaTableContainer
                arrayAction={arrayAction}
            />
        </div>
    )
}

export default AgendaHandler
