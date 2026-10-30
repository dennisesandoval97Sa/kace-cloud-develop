import PropTypes from "prop-types";
import { useState } from "react";
import MultiSelect from "@/componentsV2/core/MultiSelect";
import useDebounced from "@/hooks/useDebounced";
import useGenericSearchInfiniteQuery from "@/hooks/useGenericSearchInfiniteQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const ClassificationSelect = ({
    label,
    onSelect,
    type,
    nextY = 300,
    disabled = false,
}) => {
    const [filter, setFilter] = useState("");

    const getNodeColor = (type) => {
        switch (type) {
            case "primary":
                return { backgroundColor: "rgb(80, 110, 231)", color: "white" };
            case "subclassification":
                return { backgroundColor: "rgb(104, 232, 196)", color: "black" };
            default:
                return { backgroundColor: "rgb(200, 200, 200)", color: "black" };
        }
    };

    const buildNode = (stack, id, type) => {
        const data = stack.find((item) => item.id === id);
        if (!data || !data.description) return null;

        return {
            id: data.id,
            position: { x: 225, y: nextY },
            data: { id: data.id, label: data.description, type },
            selected: false,
            positionAbsolute: { x: 0, y: 0 },
            dragging: false,
            style: getNodeColor(type),
            deletable: false,
            className: "end-node",
        };
    };

    const processData = (data) => {
        const allItems = data?.data ?? data?.pages?.flatMap(({ data }) => data) ?? [];
        return allItems
            .filter((item) => item && item.id && item.description)
            .map((item) => ({
                id: item.id,
                label: item.description,
                value: item.id,
                description: item.description,
            }));
    };

    const {
        data: infiniteData = [],
        isLoading: isLoadingInfinite,
        isFetchingNextPage,
        fetchNextPage,
    } = useGenericSearchInfiniteQuery({
        url: `${URL_AND_KEYS.classification.url}/search`,
        keyQuery: [`classificationSelect-${type}`, filter],
        filter: [
            { field: `${URL_AND_KEYS.classification.entity}.is_active`, operator: "eq", value: 1, type: "AND" },
            { field: `${URL_AND_KEYS.classification.entity}.can_start_sub_cases_flow`, operator: "eq", value: type === "primary" ? "true" : "false", type: "AND" },
            ...(filter ? [
                {
                    field: `${URL_AND_KEYS.classification.view}.description`,
                    operator: "ilike",
                    value: filter,
                    type: "AND"
                },
            ] : []),
        ],
        select: processData,
        pageSize: 10,
        table: URL_AND_KEYS.classification.entity,
    });

    const handlerOnInputChange = useDebounced((value) => {
        setFilter(value);
    }, 500);

    const handleSelect = (value) => {
        const selectedData = infiniteData.find((item) => item.id === value);
        if (selectedData) {
            const node = buildNode(infiniteData, value, type);
            if (node) onSelect(node);
        }
    };

    return (
        <div className="relative h-10">
            <MultiSelect
                type="button"
                selectedData={[]}
                options={infiniteData}
                isLoading={isLoadingInfinite || disabled}
                onSelectOption={handleSelect}
                isFetchingNextPage={isFetchingNextPage}
                fetchNextPage={fetchNextPage}
                onInputChange={handlerOnInputChange}
                placeholder={label}
                hiddenSelectedAll
                single
                disabled={disabled}
            />
        </div>
    );
};

ClassificationSelect.propTypes = {
    label: PropTypes.string.isRequired,
    onSelect: PropTypes.func.isRequired,
    type: PropTypes.oneOf(["primary", "subclassification"]).isRequired,
    nextY: PropTypes.number,
    disabled: PropTypes.bool,
};

export default ClassificationSelect;
