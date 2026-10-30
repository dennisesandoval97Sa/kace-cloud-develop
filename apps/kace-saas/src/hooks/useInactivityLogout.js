import { useCallback, useEffect, useRef, useState } from "react";

const SESSION_EXPIRATION_KEY = "sessionExpiration";

function readExpirationMs() {
    const raw = localStorage.getItem(SESSION_EXPIRATION_KEY);
    if (raw == null) return NaN;
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
}

function useInactivityLogout({ inactivityMinutes, warningMinutes, enabled, onLogout, onContinue, oneScriptOrigin }) {
    const [showModal, setShowModal] = useState(false);
    const [countdown, setCountdown] = useState(0);

    const showModalRef = useRef(false);
    const isLoggingOutRef = useRef(false);
    const inactivityMinutesRef = useRef(inactivityMinutes);
    const warningMinutesRef = useRef(warningMinutes);
    const onLogoutRef = useRef(onLogout);
    const onContinueRef = useRef(onContinue);

    const dismissedWithoutContinueRef = useRef(false);
    const warningModalShownForCycleRef = useRef(false);

    useEffect(() => {
        inactivityMinutesRef.current = inactivityMinutes;
        warningMinutesRef.current = warningMinutes;
        onLogoutRef.current = onLogout;
        onContinueRef.current = onContinue;
    });

    const handleCloseModal = useCallback(() => {
        dismissedWithoutContinueRef.current = true;
        showModalRef.current = false;
        setShowModal(false);
    }, []);

    const handleContinue = useCallback(() => {
        const mins = inactivityMinutesRef.current;
        const now = Date.now();
        localStorage.setItem(SESSION_EXPIRATION_KEY, String(now + mins * 60 * 1000));
        dismissedWithoutContinueRef.current = false;
        warningModalShownForCycleRef.current = false;
        showModalRef.current = false;
        setShowModal(false);
        setCountdown(0);
        void Promise.resolve(onContinueRef.current?.()).catch(() => {});
    }, []);

    useEffect(() => {
        if (!enabled) {
            showModalRef.current = false;
            dismissedWithoutContinueRef.current = false;
            warningModalShownForCycleRef.current = false;
            setShowModal(false);
            setCountdown(0);
            return undefined;
        }

        const resetSession = () => {
            const mins = inactivityMinutesRef.current;
            const now = Date.now();
            localStorage.setItem(SESSION_EXPIRATION_KEY, String(now + mins * 60 * 1000));
            dismissedWithoutContinueRef.current = false;
            warningModalShownForCycleRef.current = false;
            showModalRef.current = false;
            setShowModal(false);
            setCountdown(0);
        };

        resetSession();

        const bumpActivity = () => {
            if (showModalRef.current) return;
            const mins = inactivityMinutesRef.current;
            const now = Date.now();
            localStorage.setItem(SESSION_EXPIRATION_KEY, String(now + mins * 60 * 1000));
        };

        const handleClick = () => bumpActivity();
        const handleKeydown = () => bumpActivity();

        const handleStorage = (event) => {
            if (event.storageArea !== localStorage) return;
            if (event.key !== SESSION_EXPIRATION_KEY || event.newValue == null) return;
            const exp = Number(event.newValue);
            if (!Number.isFinite(exp)) return;
            const fullMs = inactivityMinutesRef.current * 60 * 1000;
            const timeLeft = exp - Date.now();
            const slack = 15000;
            if (timeLeft > 0 && Math.abs(timeLeft - fullMs) < slack) {
                dismissedWithoutContinueRef.current = false;
                warningModalShownForCycleRef.current = false;
                showModalRef.current = false;
                setShowModal(false);
                setCountdown(0);
            }
        };

        const handleMessage = (event) => {
            if (oneScriptOrigin != null && event.origin !== oneScriptOrigin) return;
            const type = event.data?.type;
            if (type === "KACE_ONE_SCRIPT_INTERACTION") bumpActivity();
        };

        document.addEventListener("click", handleClick);
        document.addEventListener("keydown", handleKeydown);
        window.addEventListener("storage", handleStorage);
        window.addEventListener("message", handleMessage);

        const intervalId = setInterval(() => {
            const expMs = readExpirationMs();
            const timeLeft = Number.isFinite(expMs) ? expMs - Date.now() : -Infinity;
            const warningMs = warningMinutesRef.current * 60 * 1000;

            if (timeLeft <= 0) {
                if (!isLoggingOutRef.current) {
                    isLoggingOutRef.current = true;
                    showModalRef.current = false;
                    setShowModal(false);
                    void Promise.resolve(onLogoutRef.current?.())
                        .catch(() => {})
                        .finally(() => {
                            isLoggingOutRef.current = false;
                        });
                }
                return;
            }

            if (showModalRef.current) {
                const secs = Math.max(0, Math.ceil(timeLeft / 1000));
                setCountdown((prev) => (prev !== secs ? secs : prev));
                return;
            }

            if (dismissedWithoutContinueRef.current) {
                return;
            }

            if (warningMinutesRef.current <= 0) {
                return;
            }

            if (timeLeft >= warningMs) {
                warningModalShownForCycleRef.current = false;
            }

            if (timeLeft < warningMs && timeLeft > 0 && !warningModalShownForCycleRef.current) {
                warningModalShownForCycleRef.current = true;
                showModalRef.current = true;
                setShowModal(true);
                setCountdown(Math.max(0, Math.ceil(timeLeft / 1000)));
            }
        }, 1000);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener("click", handleClick);
            document.removeEventListener("keydown", handleKeydown);
            window.removeEventListener("storage", handleStorage);
            window.removeEventListener("message", handleMessage);
        };
    }, [enabled, inactivityMinutes, warningMinutes, oneScriptOrigin]);

    return {
        showModal,
        countdown,
        handleContinue,
        handleCloseModal,
    };
}

export default useInactivityLogout;
