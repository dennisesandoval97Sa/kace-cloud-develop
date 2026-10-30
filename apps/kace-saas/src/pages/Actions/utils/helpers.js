import { apiService } from "../../../utils/main";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";

export const getClassificationLevels = async () => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const results = [];

    for (let level = 1; level <= 10; level++) {
        try {
            if (level > 1) {
                await delay(500);
            }

            const response = await apiService.get(
                `${URL_AND_KEYS.classification.urlClassificationLevels}/nivel${level}`,
                {
                    limit: 0,
                    offset: 0,
                },
            );

            // NO-SONAR: se utilizan las sentencias "continue" para evitar anidar muchos ifs, evitando identar mucho el codigo y que sea mas legible
            if (!response?.data?.data?.items) continue;

            const filterData = response.data.data.items.filter((item) => item !== null && item !== "");

            // NO-SONAR: se utilizan las sentencias "continue" para evitar anidar muchos ifs, evitando identar mucho el codigo y que sea mas legible
            if (filterData.length === 0) continue;

            results.push({
                data: response.data.data.items,
                level: `nivel${level}`,
            });
        } catch {
            // NO-SONAR: No se maneja el error explícitamente para evitar interrumpir el flujo en caso de error en una iteración.
        }
    }
    return results;
};

function capitalizeWords(text) {
    return text
        .toLowerCase()
        .split(" ")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

export const getUsers = async () => {
    try {
        const filter = {
            filter: [
                {
                    field: "deleted_at",
                    operator: "null",
                    type: "AND",
                    value: "null"
                }
            ],
            limit: 0,
            offset: 0,
            order: {
                direction: "desc",
                field: "created_at"
            },
        }
        const usersData = await apiService.post(`${URL_AND_KEYS.users.url}/search`, filter)
        const users = usersData?.data?.data?.items ?? [];

        const userOptions = users.map(user => {
            const fullName = capitalizeWords(`${user.nombres ?? ""} ${user.apellido1 ?? ""} ${user.apellido2 ?? ""}`.trim());
            return {
                id: user.id,
                label: fullName,
                value: user.id
            }
        });

        return userOptions;

    } catch (error) {
        return []
    }

}
