import { useState, useEffect } from "react";
import getClientFingerprint from "@/utils/fingerprint";

const useFingerprint = () => {
    const [fingerprint, setFingerprint] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let isMounted = true;

        const fetchFingerprint = async () => {
            try {
                setIsLoading(true);
                const fp = await getClientFingerprint();
                if (isMounted) {
                    setFingerprint(fp);
                    setError(null);
                }
            } catch (err) {
                if (isMounted) {
                    setError(err);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchFingerprint();

        return () => {
            isMounted = false;
        };
    }, []);

    return { fingerprint, isLoading, error };
};

export default useFingerprint;
