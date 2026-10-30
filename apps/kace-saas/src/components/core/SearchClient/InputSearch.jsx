import { PropTypes } from "prop-types"
import { cn, Input as InputCustom } from "@kace/ui-shared"

export const InputSearch = ({
    field = {},
    className = "",
    classNameInput = "",
    ...props
}) => {
    const id = props.id ? props.id : props.name

    return (
        <InputCustom
            id={id}
            {...field}
            {...props}
            className={cn("w-24 focus:w-30 transition-all duration-300", classNameInput)}
            autoComplete="off"
            data-testid={`input_search_${id}`}
        />
    );
}

InputSearch.propTypes = {
    name: PropTypes.string.isRequired,
    type: PropTypes.string,
    id: PropTypes.string,
    label: PropTypes.string,
    placeholder: PropTypes.string,
    className: PropTypes.string,
    field: PropTypes.object,
    meta: PropTypes.object,
    classNameInput: PropTypes.string
}
