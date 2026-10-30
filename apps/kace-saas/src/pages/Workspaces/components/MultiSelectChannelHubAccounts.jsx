import { MultiSelect } from "@kace/ui-shared";
import { PropTypes } from "prop-types";
import { useTranslation } from "react-i18next";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { useSearchableMultiSelect } from "../hooks/useSearchableMultiSelect";

const EMPTY_VALUES = [];

const toChannelHubAccountOption = (item) => {
    const label = item.email || item.description || item.name || item.id;
    const value = [item.email, item.name, item.description].filter(Boolean).join(" ") || label;

    return {
        id: item.id,
        label,
        value,
    };
};

export const MultiSelectChannelHubAccounts = ({
    listValues,
    setListValues,
    values = EMPTY_VALUES,
    enableSearch = false,
    ariaDescribedBy,
    ariaInvalid = false,
}) => {
    const { t } = useTranslation();
    const multiSelectProps = useSearchableMultiSelect({
        url: `${URL_AND_KEYS.channel_hub.url}/search`,
        keyQuery: URL_AND_KEYS.channel_hub.key,
        searchField: "email",
        toOption: toChannelHubAccountOption,
        listValues,
        setListValues,
        values,
        enableSearch,
    });

    return (
        <MultiSelect
            {...multiSelectProps}
            textSearch={t("channelHub.textSearchAccounts")}
            nameTesting="channelHubAccounts"
            hideSelectAll={true}
            triggerAriaLabel={t("workspace.form.channel_hub_accounts")}
            triggerAriaDescribedBy={ariaDescribedBy}
            triggerAriaInvalid={ariaInvalid}
        />
    );
};

MultiSelectChannelHubAccounts.propTypes = {
    listValues: PropTypes.array,
    setListValues: PropTypes.func,
    values: PropTypes.array,
    enableSearch: PropTypes.bool,
    ariaDescribedBy: PropTypes.string,
    ariaInvalid: PropTypes.bool,
};
