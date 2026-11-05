import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createQuickLink, deleteQuickLink, fetchQuickLinks } from "../services/quickLinks.service";

const QUERY_KEY = ["quick-links"];

export default function useQuickLinks(enabled = true) {
    const queryClient = useQueryClient();
    const list = useQuery({ queryKey: QUERY_KEY, queryFn: fetchQuickLinks, enabled });
    const create = useMutation({
        mutationFn: createQuickLink,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    });
    const remove = useMutation({
        mutationFn: deleteQuickLink,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    });
    return { list, create, remove };
}
