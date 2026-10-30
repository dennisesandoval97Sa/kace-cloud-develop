import { useSearchParams } from "react-router-dom";

const useIsSeeMode = () => {
    const [searchParams] = useSearchParams();
    return searchParams.get("action") === "see";
};

export default useIsSeeMode;
