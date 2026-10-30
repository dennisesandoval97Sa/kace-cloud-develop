import { useQueryClient } from "@tanstack/react-query";

const useSelectedCase = () => {
    const queryClient = useQueryClient();
    const caseSelect = queryClient.getQueryData(["selectedCaseData"]) || {};
    return { caseSelect };
};

export default useSelectedCase;
