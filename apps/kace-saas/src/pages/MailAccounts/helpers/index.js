import { Uuid } from "@kace/plugins";
import { removeKey } from "@kace/utils";
import { filterDeleted, orderFilter } from "../../../services/genericFilter";

export const filterMailAccounts = {
    filter: [filterDeleted],
    order: orderFilter,
};

const RETIRED_MAIL_ACCOUNT_FORM_FIELDS = ["register_in_channel_hub"];

export const formatMailAccountFormData = (data) => removeKey(data, RETIRED_MAIL_ACCOUNT_FORM_FIELDS);

export const formatDataBeforePost = (data, id) => {
    data = transformData(formatMailAccountFormData(data));
    return id
        ? removeKey(data, ["id", "created_at", "updated_at", "created_by", "deleted_by", "deleted_at"])
        : { ...data, id: Uuid() };
};
const transformData = (data) => {
    return Object.keys(data).reduce((acc, key) => {
        const value = data[key];

        if (value !== null && value !== "") {
            acc[key] = value;
        } else if (value === "") {
            acc[key] = null;
        }

        return acc;
    }, {});
};

export const initialValues = {
    description: "",
    type: "",
    host: "",
    port: "",
    protocol: "",
    encryption: "",
    username: "",
    password: "",
    from_address: "",
    from_name: "",
    tenant_id: "",
    client_id: "",
    client_secret: "",
    code: "",
    refresh_token: "",
    mails_download_limit: "",
    login_endpoint: "",
    graph_scope: "",
    start_syncing_from: "",
    last_synchronization: "",
    folders: [],
    access_token: "",
    email_account: "",
    vault: false,
    vault_data: {},
    is_active: 1,
};
