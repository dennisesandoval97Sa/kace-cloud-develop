export const handleState = (data) => {
    return data.map((item) => {
        return { ...item, status: item.status === 1 ? "Activo" : "Inactivo" }
    })
}

const createUTCDate = (dateString) => {
    const date = new Date(dateString)
    return new Date(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds()
    )
        .toLocaleString()
        .replace(",", "")
}

export const handleStateTimer = (data = []) => {
    if (!data || !Array.isArray(data)) {
        return data
    }
    return data.map((item) => {
        if (!item || !item.created_at) {
            return item
        }

        if (item.start_date) {
            return {
                ...item,
                start_date: createUTCDate(item.start_date),
                end_date: createUTCDate(item.end_date)
            }
        }

        if (item.updated_at) {
            return {
                ...item,
                updated_at: createUTCDate(item.updated_at),
                created_at: createUTCDate(item.created_at)
            }
        }

        return {
            ...item,
            created_at: createUTCDate(item.created_at)
        }
    })
}

export const handleColor = (data = [], fields = []) => {
    return data.map((file) => {
        fields.forEach((field) => {
            if (file[field]) {
                file[field] = (
                    <div
                        className={`bg-${file[field]} w-4 h-4 rounded-full`}
                    ></div>
                )
            }
        })
        return file
    })
}
