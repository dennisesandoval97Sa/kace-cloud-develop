import { MultiSelect } from "@kace/ui-shared"
import { apiService, USER_SERVICE } from "@kace/utils"
import { useQuery } from "@tanstack/react-query"
import { useState, useEffect } from "react"

import { PropTypes } from "prop-types"

export const MultiSelectClientForm = ({ listValues, setListValues, setValues }) => {
    const [dataUsers, setDataUsers] = useState([])
    const { data: dataUsersList } = useQuery({
        queryKey: ["users"],
        queryFn: () => apiService.get(USER_SERVICE)
    })
    const handleDataUsers = (data = []) => {
        const newArray = data.items.map((item) => {
            return {
                id: item.id,
                label:
                    item.nombres + " " + item.apellido1 + " " + item.apellido2,
                value:
                    item.nombres +
                    " " +
                    item.apellido1 +
                    " " +
                    item.apellido2 +
                    " " +
                    item.email
            }
        })
        setDataUsers(newArray)
    }
    useEffect(() => {
        if (dataUsersList) {
            handleDataUsers(dataUsersList.data.data)
        }
    }, [dataUsersList])
    useEffect(() => {
        const filterList = listValues.map((item) => item.id)
        setValues((prevValues) => ({
            ...prevValues,
            contactos: filterList
        }))
    }, [listValues])
    return (
        <MultiSelect
            data={dataUsers}
            textSearch="Buscar usuarios..."
            listValues={listValues}
            setListValues={setListValues}
        />
    )
}

MultiSelectClientForm.propTypes = {
    listValues: PropTypes.array,
    setListValues: PropTypes.func,
    setValues: PropTypes.func
}
