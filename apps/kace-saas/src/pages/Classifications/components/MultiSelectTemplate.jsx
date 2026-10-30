import { MultiSelect } from "@kace/ui-shared";
import { PropTypes } from "prop-types";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useClassificationTemplateSelect } from "../hooks/useClassificationTemplateSelect";
import { sortTemplatesAlphabetically } from "../helpers/fetchAllMatchingTemplates";

export const MultiSelectTemplate = ({ listValues, setListValues }) => {
    const { t } = useTranslation();
    const {
        data,
        isLoading,
        isLoadingMore,
        hasMore,
        searchQuery,
        setSearchQuery,
        setPage,
        followInput,
        hideSearchButton,
        open,
        onOpenChange,
        selectAllMatchingOrClear,
    } = useClassificationTemplateSelect();

    const options = useMemo(() => {
        const loadedIds = new Set(data.map((option) => option.id));
        const searchTerm = String(searchQuery?.filter ?? searchQuery?.input ?? "")
            .trim()
            .toLowerCase();
        const missingSelected = listValues.filter((item) => {
            if (loadedIds.has(item.id)) return false;
            if (!searchTerm) return true;
            return String(item.label ?? "")
                .toLowerCase()
                .includes(searchTerm);
        });

        return [...sortTemplatesAlphabetically(data), ...sortTemplatesAlphabetically(missingSelected)];
    }, [data, listValues, searchQuery]);

    const handleSelectAll = useCallback(() => {
        selectAllMatchingOrClear(listValues, setListValues);
    }, [listValues, selectAllMatchingOrClear, setListValues]);

    return (
        <MultiSelect
            data={options}
            textSearch={t("classification.form.textSearchTemplates")}
            listValues={listValues}
            setListValues={setListValues}
            nameTesting="templates"
            id="multi_select_template"
            data-testid="multi_select_template"
            isLoading={isLoading}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            setPage={setPage}
            followInput={followInput}
            hideSearchButton={hideSearchButton}
            open={open}
            onOpenChange={onOpenChange}
            onSelectAll={handleSelectAll}
        />
    );
};

MultiSelectTemplate.propTypes = {
    listValues: PropTypes.array,
    setListValues: PropTypes.func,
};
