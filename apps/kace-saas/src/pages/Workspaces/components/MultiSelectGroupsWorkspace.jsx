import { MultiSelect } from "@kace/ui-shared";
import { PropTypes } from "prop-types";
import { useTranslation } from "react-i18next";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { useSearchableMultiSelect } from "../hooks/useSearchableMultiSelect";

const EMPTY_VALUES = [];

const toGroupOption = (item) => {
    const label = item.nombre || item.name || item.id;
    const value = [item.nombre, item.descripcion].filter(Boolean).join(" ") || label;

    return {
        id: item.id,
        label,
        value,
    };
};

export const MultiSelectGroupsWorkspace = ({
    listValues,
    setListValues,
    values = EMPTY_VALUES,
    enableSearch = false,
}) => {
    const { t } = useTranslation();
    const multiSelectProps = useSearchableMultiSelect({
        url: `${URL_AND_KEYS.groups.url}/search`,
        keyQuery: URL_AND_KEYS.groups.key,
        searchField: "nombre",
        toOption: toGroupOption,
        listValues,
        setListValues,
        values,
        enableSearch,
    });

    return <MultiSelect {...multiSelectProps} textSearch={t("groups.form.textSearchGroups")} nameTesting="groups" />;
};

MultiSelectGroupsWorkspace.propTypes = {
    listValues: PropTypes.array,
    setListValues: PropTypes.func,
    values: PropTypes.array,
    enableSearch: PropTypes.bool,
};
