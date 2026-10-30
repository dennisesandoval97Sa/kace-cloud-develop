import { useState, useCallback } from "react";
import { fetchSubcases } from "@/pages/Cases/hooks/useCasesTableData";

const mapSubcaseItem = (i) => ({
    id: i.id,
    reference: i.reference,
    nombreCliente: i.nombreCliente,
    estadoActual: i.estadoActual,
    nombres: i.nombres,
    apellido1: i.apellido1,
    created_at: i.created_at ?? i.createdAt,
    nivel1: i.nivel1,
    nivel2: i.nivel2,
    nivel3: i.nivel3,
    nivel4: i.nivel4,
    nivel5: i.nivel5,
    nivel6: i.nivel6,
    nivel7: i.nivel7,
    nivel8: i.nivel8,
    nivel9: i.nivel9,
    nivel10: i.nivel10,
});

const useSubcasesPanel = () => {
    const [subcasesPageByParent, setSubcasesPageByParent] = useState({});
    const [loadingByParent, setLoadingByParent] = useState({});
    const [errorByParent, setErrorByParent] = useState({});

    const handleInitialLoadSubcases = useCallback(
        async (caseId) => {
            const normalizedCaseId = caseId?.toString();
            if (subcasesPageByParent[normalizedCaseId] ?? subcasesPageByParent[caseId]) return;

            setLoadingByParent((prev) => ({ ...prev, [normalizedCaseId]: true, [caseId]: true }));
            try {
                const limit = 10;
                const offset = 0;
                const data = await fetchSubcases(caseId, { limit, offset });
                const totalCount = Number(data?.total ?? 0);
                const raw = Array.isArray(data?.data) ? data?.data : [];
                const items = raw.map(mapSubcaseItem);
                const nextOffset = offset + items.length;
                const hasMore = nextOffset < totalCount;
                const dataToStore = { items, offset: nextOffset, totalCount, hasMore };
                setSubcasesPageByParent((prev) => ({
                    ...prev,
                    [normalizedCaseId]: dataToStore,
                    [caseId]: dataToStore,
                }));
            } catch (error) {
                setErrorByParent((prev) => ({ ...prev, [normalizedCaseId]: error.message, [caseId]: error.message }));
            } finally {
                setLoadingByParent((prev) => ({ ...prev, [normalizedCaseId]: false, [caseId]: false }));
            }
        },
        [subcasesPageByParent],
    );

    const handleLoadMoreSubcases = useCallback(
        async (caseId) => {
            const currentPage = subcasesPageByParent[caseId] ?? subcasesPageByParent[caseId?.toString()];
            if (!currentPage) return;
            const { hasMore, offset, totalCount } = currentPage;
            if (!hasMore || currentPage.items.length >= totalCount) return;

            setLoadingByParent((prev) => ({ ...prev, [caseId]: true }));
            try {
                const limit = 10;
                const data = await fetchSubcases(caseId, { limit, offset });
                const raw = Array.isArray(data?.data) ? data?.data : [];
                const newItems = raw.map(mapSubcaseItem);
                const nextOffset = offset + newItems.length;
                const nextHasMore = nextOffset < totalCount;
                setSubcasesPageByParent((prev) => ({
                    ...prev,
                    [caseId]: {
                        items: [...currentPage.items, ...newItems],
                        offset: nextOffset,
                        totalCount,
                        hasMore: nextHasMore,
                    },
                    [caseId?.toString()]: {
                        items: [...currentPage.items, ...newItems],
                        offset: nextOffset,
                        totalCount,
                        hasMore: nextHasMore,
                    },
                }));
            } catch (error) {
                setErrorByParent((prev) => ({ ...prev, [caseId]: error.message }));
            } finally {
                setLoadingByParent((prev) => ({ ...prev, [caseId]: false }));
            }
        },
        [subcasesPageByParent],
    );

    return {
        subcasesPageByParent,
        loadingByParent,
        errorByParent,
        handleInitialLoadSubcases,
        handleLoadMoreSubcases,
    };
};

export default useSubcasesPanel;
