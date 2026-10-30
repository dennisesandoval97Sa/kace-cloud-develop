import PropTypes from "prop-types"

import SchemasStringField from "./SchemasStringField"
import SchemasNumberField from "./SchemasNumberField"
import SchemasBooleanField from "./SchemasBooleanField"
import SchemasReferencedSchemaField from "./SchemasReferencedSchemaField"
import SchemasDateField from "./SchemasDateField"
import SchemasCalculatedField from "./SchemasCalculatedField"

const SchemasFields = ({ type, namePrefix, index }) => {
    switch (type) {
    case "string":
        return <SchemasStringField namePrefix={namePrefix} index={index} />
    case "number":
        return <SchemasNumberField namePrefix={namePrefix} index={index} />
    case "boolean":
        return <SchemasBooleanField namePrefix={namePrefix} index={index} />
    case "date":
        return <SchemasDateField namePrefix={namePrefix} index={index} />
    case "calculated":
        return <SchemasCalculatedField namePrefix={namePrefix} index={index} />
    default:
        return <SchemasReferencedSchemaField namePrefix={namePrefix} index={index} />
    }
}

SchemasFields.propTypes = {
    type: PropTypes.string.isRequired,
    namePrefix: PropTypes.string.isRequired,
    index: PropTypes.number.isRequired
}

export default SchemasFields
