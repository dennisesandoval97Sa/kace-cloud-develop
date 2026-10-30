import { handleFullName } from "@/utils/main";

const capitalizeWords = (text) => {
    return text
        .toLowerCase()
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
};

export const processUsersData = (data) => {
    try {
        const allItems = data?.data ?? data?.pages.flatMap(({ data }) => data) ?? [];
        const fullNameUsersData = handleFullName(allItems) ?? [];

        return fullNameUsersData.map((user) => ({
            id: user.id,
            label: capitalizeWords(user.nombres),
            value: user.nombres,
        }));
    } catch (error) {
        return [];
    }
};
