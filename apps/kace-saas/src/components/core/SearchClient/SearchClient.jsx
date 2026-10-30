import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ModalUsersInformation } from "./ModalUsersInformation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { searchCasesByField, searchClientFetch } from "../../../services/searchClient"
import SearchClientForm from "./SearcClientForm"
import { useSelector, useDispatch } from "react-redux"
import { UserRoundSearch } from "lucide-react"
import { Button } from "@kace/ui-shared"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import useGeolocation from "@kace/hooks/useGeolocation"
import { GeolocationTypes } from "../../../enums/GeolocationTypes"
import { COLUMNS_OBJECT } from "./constants"
import { setLoadingCaseInformation } from "../../../redux/state/loadingCaseInformation"
import { clearStates, setCaseId, setReference } from "../../../redux/state/states"

const TYPE_TO_CASES = [
    "reference"
]

const SearchClient = () => {
    const { t } = useTranslation()
    const [openModal, setOpenModal] = useState(false)
    const [dataModal, setDataModal] = useState([])
    const [dataFields, setDataFields] = useState([])
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const [columns, setColumns] = useState([...COLUMNS_OBJECT, {
        id: "actions",
        cell: ({ row }) => {
            return (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                        setTimeout(() => {
                            navigate(`/agent/${row.original.id}`)
                        }, 0);
                        setOpenModal(false)
                    }}
                    id="btn_search_agent"
                    data-testid="btn_search_agent"
                >
                    <UserRoundSearch />
                </Button>
            )
        }
    }])
    const configAdmin = useSelector((state) => state.generalSetup.configAdmin)
    const configAgent = useSelector((state) => state.generalSetup.configAgent)

    const { handleGeolocation } = useGeolocation()

    const handleGeolocationSearchClient = async () => {
        const behavior = GeolocationTypes.CLIENT_SEARCH
        await handleGeolocation(behavior.value, 5000)
    }

    const queryClient = useQueryClient()

    const { mutate: mutateByClient, isPending: isPendingByClient } = useMutation({
        mutationKey: ["searchClientsForField"],
        mutationFn: searchClientFetch,
        onMutate: () => {
            setOpenModal(true)
        },
        onSuccess: (data) => {
            const newData = data.data.map(item => {
                if (!item.nombres && item.tipo_documento.toUpperCase() === "NIT") {
                    item.nombres = item.nombre_empresa
                }
                return item
            })
            setDataModal(newData)
            queryClient.setQueryData(["searchClientsForField"], newData)
            handleGeolocationSearchClient()
        },
        onError: () => {
            const emptyData = { data: [] }
            setDataModal(emptyData)
            queryClient.setQueryData(["searchClientsForField"], emptyData)
            toast.error(t("app.alerts.notSearch"))
        }
    })

    const handleSearchParams = (values) => {
        if (isPendingByClient) return
        const { type, payload } = values
        if (TYPE_TO_CASES.includes(type)) {
            dispatch(setLoadingCaseInformation(true))
            values.payload = parseInt(values.payload)
            toast.promise(searchCasesByField(values), {
                loading: "Buscando información del caso...",
                success: (data) => {
                    dispatch(setLoadingCaseInformation(false))
                    if (data.data.length === 0) {
                        return "No se encontró información del caso, por favor valide los datos"
                    } else {
                        dispatch(clearStates())
                        dispatch(setReference(payload))
                        dispatch(setCaseId(data?.data[0].id))
                        navigate(`/agent/update/${data?.data[0].id}?action=edit`)
                        return "Información del caso encontrada correctamente"
                    }
                },
                position: "top-center",
                className: "bg-blue-400",
                closeButton: true,
                error: () => {
                    dispatch(setLoadingCaseInformation(false))
                    return "Ocurrió un error al buscar la información del caso"
                }
            })
        } else {
            mutateByClient(values)
        }
    }

    useEffect(() => {
        if (configAdmin && configAgent) {
            const result = []
            const { search_clients } = configAgent
            Object.entries(search_clients).forEach(([key, value]) => {
                const formatKey = key.replace("_bool", "")
                if (value) {
                    const field = {
                        id: formatKey,
                        label: configAdmin.clients[formatKey],
                        value: formatKey
                    }
                    setColumns((prevColumns) => {
                        const newColumns = prevColumns.map((column) => {
                            if (column.accessorKey === formatKey) {
                                return {
                                    ...column,
                                    isVisible: value
                                }
                            }
                            return column
                        })
                        return newColumns
                    })
                    result.push(field)
                }
            })
            setDataFields(result)
        }
    }, [configAdmin, configAgent])

    return (
        <>
            <SearchClientForm
                dataHandler={handleSearchParams}
                options={dataFields}
            />
            <ModalUsersInformation
                data={dataModal}
                openModal={openModal}
                setOpenModal={setOpenModal}
                isLoading={isPendingByClient}
                columns={columns}
            />
        </>
    )
}

export default SearchClient
