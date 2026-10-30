import { useField } from "formik"
import { cloneElement } from "react"

export const KField = ({ children }) => {
    const [field, meta] = useField(children.props.name)
    return cloneElement(children, {
        field,
        meta
    })
}
