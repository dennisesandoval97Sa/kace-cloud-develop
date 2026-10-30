import { PropTypes } from "prop-types";
import { DropdownButton } from "@kace/ui-shared";
import { v4 as uuidv4 } from "uuid";
import { useState } from "react";
import MultiSelect from "@/componentsV2/core/MultiSelect";
import useGenericSearchInfiniteQuery from "@/hooks/useGenericSearchInfiniteQuery";
import useDebounced from "@/hooks/useDebounced";

const processData = (data) => {
    try {
        const allItems = data?.data ?? data?.pages?.flatMap(({ data }) => data) ?? [];
        return allItems
            .filter((item) => item && item.id && item.description)
            .map((item) => ({
                id: item.id,
                label: item.description,
                value: item.description,
                description: item.description,
            }));
    } catch (error) {
        return [];
    }
};

const NodeSelect = ({
    label,
    options = [],
    onSelect,
    type,
    nextY = 200,
    disabled = false,
    url,
    tableName,
    useInfinite = false,
}) => {
    const [filter, setFilter] = useState([]);

    const getNodeColor = (type) => {
        let color = "";

        switch (type) {
            case "function":
                color = {
                    backgroundColor: "rgb(231, 110, 80)",
                    color: "white",
                };
                break;
            case "endpoint":
                color = {
                    backgroundColor: "rgb(232, 196, 104)",
                    color: "black",
                };
                break;
        }

        return color;
    };

    const buildNode = (stack, id, type) => {
        const data = stack.find((item) => item.id === id);

        if (!data || !data.description) {
            return null;
        }

        return {
            id: uuidv4(),
            position: { x: 225, y: nextY },
            data: {
                id: data.id,
                label: data.description,
                type,
            },
            selected: false,
            positionAbsolute: { x: 0, y: 0 },
            dragging: false,
            style: getNodeColor(type),
        };
    };

    const {
        data: infiniteData = [],
        isLoading: isLoadingInfinite,
        isFetchingNextPage,
        fetchNextPage,
    } = useGenericSearchInfiniteQuery({
        url: url || "",
        keyQuery: [`nodeSelect-${type}`, filter],
        filter: [
            {
                field: `${tableName}.is_active`,
                operator: "eq",
                value: 1,
                type: "AND",
            },
            ...filter,
        ],
        enabled: useInfinite && Boolean(url),
        select: processData,
        pageSize: 10,
        table: tableName,
    });

    const handlerOnInputChange = useDebounced((value) => {
        if (!useInfinite) return;

        if (!value) {
            setFilter([]);
            return;
        }

        setFilter([
            {
                field: tableName ? `${tableName}.description` : "description",
                operator: "ilike",
                value,
                type: "AND",
            },
        ]);
    }, 500);

    const handlerSelect = (value) => {
        if (useInfinite) {
            const selectedData = infiniteData.find((item) => item.id === value);
            if (selectedData) {
                const node = buildNode(infiniteData, value, type);
                if (node) {
                    onSelect(node);
                }
            }
        } else {
            const node = buildNode(options || [], value, type);
            if (node) {
                onSelect(node);
            }
        }
    };

    const dataToUse = useInfinite ? infiniteData : options || [];
    const isLoadingToUse = useInfinite ? isLoadingInfinite : disabled;

    if (useInfinite) {
        return (
            <div className="relative">
                <div className="h-10">
                    <MultiSelect
                        type="button"
                        selectedData={[]}
                        options={dataToUse}
                        isLoading={isLoadingInfinite}
                        onSelectOption={handlerSelect}
                        isFetchingNextPage={isFetchingNextPage}
                        fetchNextPage={fetchNextPage}
                        onInputChange={handlerOnInputChange}
                        placeholder={label}
                        hiddenSelectedAll
                        single
                    />
                </div>
            </div>
        );
    }

    return (
        <DropdownButton
            label={label}
            placeholder={label}
            options={dataToUse.map((fn) => ({
                value: fn.id,
                name: fn.description,
            }))}
            onSelect={handlerSelect}
            disabled={isLoadingToUse}
            menuClassName="max-h-80 overflow-y-auto"
        />
    );
};

NodeSelect.propTypes = {
    label: PropTypes.string.isRequired,
    options: PropTypes.array,
    onSelect: PropTypes.func.isRequired,
    type: PropTypes.oneOf(["function", "endpoint"]).isRequired,
    nextY: PropTypes.number,
    disabled: PropTypes.bool,
    url: PropTypes.string,
    filterFn: PropTypes.func,
    tableName: PropTypes.string,
    useInfinite: PropTypes.bool,
};

export default NodeSelect;
