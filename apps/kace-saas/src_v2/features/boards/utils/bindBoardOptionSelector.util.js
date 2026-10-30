export const bindBoardOptionSelector = (selector) => ({
    options: selector?.options ?? [],
    onSearch: selector?.onSearch,
    fetchNextPage: selector?.fetchNextPage,
    hasNextPage: selector?.hasNextPage,
    isFetchingNextPage: selector?.isFetchingNextPage,
    isLoading: selector?.isLoading,
});

export const boardOptionSelectorByType = (selectors, type) => {
    if (!type) return undefined;
    return selectors?.[type] ?? selectors?.[String(type).toUpperCase()];
};
