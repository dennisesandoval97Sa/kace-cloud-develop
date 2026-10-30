export const isViewportAtBottom = (element, threshold = 0) => {
    if (!element) return false;
    const { scrollTop, scrollHeight, clientHeight } = element;
    return scrollTop + clientHeight >= scrollHeight - threshold;
};
