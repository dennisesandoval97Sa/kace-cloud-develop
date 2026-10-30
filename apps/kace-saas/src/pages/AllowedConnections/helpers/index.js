import { Uuid } from "@kace/plugins";
import { removeKey } from "@kace/utils";
import { genericHandleSendInformation } from "../../../services/genericHandleSendInformation";

export const formatDataBeforePost = (data, id) => {
    return id
        ? removeKey(data, ["id", "created_at", "updated_at", "created_by", "deleted_by", "deleted_at"])
        : { ...data, id: Uuid() };
};

export const isHttpsEnabled = (value) => value === true || value === 1;

export const buildAllowedConnectionMutation = ({ values, urlService, setFormikErrors, setFormikStatus, pending }) => {
    const normalizedValues = isHttpsEnabled(values.has_ssl) ? values : { ...values, certificate: "" };
    const mutation = genericHandleSendInformation({
        values: normalizedValues,
        urlService,
        setFormikErrors,
        setFormikStatus,
        pending,
    });

    if (mutation && normalizedValues.id && normalizedValues.certificate === "") {
        mutation.dataPost.certificate = "";
    }

    return mutation;
};

export const initialValues = {
    id: "",
    description: "",
    connection: "",
    is_active: 1,
    has_ssl: false,
    certificate: "",
};
