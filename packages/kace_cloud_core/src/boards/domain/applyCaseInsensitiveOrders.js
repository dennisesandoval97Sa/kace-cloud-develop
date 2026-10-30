function findSelectColumnForOrder(orderFieldKey, selectColumns) {
    if (!orderFieldKey || !Array.isArray(selectColumns)) {
        return null;
    }
    return (
        selectColumns.find((col) => {
            const qualified = col.entity ? `${col.entity}.${col.field}` : col.field;
            const aliasOrField = col.alias || col.field;
            return qualified === orderFieldKey || aliasOrField === orderFieldKey || col.field === orderFieldKey;
        }) ?? null
    );
}

export function getEffectiveOrderDataType(col) {
    if (!col) {
        return null;
    }
    if (!col.function) {
        return col.data_type ?? null;
    }
    const fn = String(col.function).toLowerCase();
    if (['count', 'sum', 'avg', 'date_difference'].includes(fn)) {
        return 'NUMBER';
    }
    if (fn === 'min' || fn === 'max') {
        return col.data_type ?? null;
    }
    return col.data_type ?? null;
}

export function applyCaseInsensitiveOrders(orders, selectColumns) {
    if (!orders || !selectColumns || !Array.isArray(selectColumns)) {
        return;
    }

    const ordersArray = Array.isArray(orders) ? orders : [orders];

    ordersArray.forEach((order) => {
        const orderFieldKey = order.entity ? `${order.entity}.${order.field}` : order.field;
        const matchingCol = findSelectColumnForOrder(orderFieldKey, selectColumns);

        if (!matchingCol) {
            return;
        }

        let effectiveType = getEffectiveOrderDataType(matchingCol);

        const isOrderByAlias =
            matchingCol.alias && (orderFieldKey === matchingCol.alias || order.field === matchingCol.alias);

        if (!isOrderByAlias && matchingCol.function?.toLowerCase() === 'date_difference') {
            effectiveType = matchingCol.data_type ?? null;
        }

        if (effectiveType != null && effectiveType !== '') {
            order.data_type = effectiveType;
        }

        if (effectiveType?.toUpperCase() === 'STRING') {
            order.insensitive = true;
        }
    });
}
