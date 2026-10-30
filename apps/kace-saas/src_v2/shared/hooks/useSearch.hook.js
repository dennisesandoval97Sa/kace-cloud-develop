import { useQuery } from "@tanstack/react-query";

const useSearch = ({
    queryKey = [],
    queryFn = () => {},
    criteria = {
        filter: [
            {
                field: "deleted_at",
                operator: "null",
                type: "AND",
                value: "null",
            },
        ],
        limit: 0,
        offset: 0,
    },
    ...props
}) => {
    return useQuery({
        queryKey,
        queryFn: () => queryFn(criteria),
        ...props,
    });
};

export default useSearch;
