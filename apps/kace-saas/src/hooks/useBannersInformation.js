import { useEffect, useMemo, useRef, useState } from "react";
import { URL_AND_KEYS } from "../utils/urlAndKeys";
import useGenericSearchQuery from "./useGenericSearchQuery";
import useUserInformation from "./useUserInformation";

const useBannersInformation = () => {
    const { user } = useUserInformation();
    const [currentBannerBelow, setCurrentBannerBelow] = useState({
        message: "",
        icon: null,
        color: "",
        place: "",
    });
    const [currentBannerAbove, setCurrentBannerAbove] = useState({
        message: "",
        icon: null,
        color: "",
        place: "",
    });
    const [numberBannersAbove, setNumberBannersAbove] = useState(0);
    const [numberBannersBelow, setNumberBannersBelow] = useState(0);
    const [showBannerBelow, setShowBannerBelow] = useState(false);
    const [showBannerAbove, setShowBannerAbove] = useState(false);
    const animationDurationAbove = useRef(null);
    const animationDurationBelow = useRef(null);
    const dateFilter = useMemo(() => new Date().toISOString(), []);
    const { data: dataTable } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.banners.url}/search`,
        keyQuery: URL_AND_KEYS.banners.key,
        filter: [
            {
                field: "status",
                operator: "eq",
                value: 1,
                type: "AND",
            },
            {
                field: "fecha_inicio",
                operator: "lte",
                value: dateFilter,
                type: "AND",
            },
            {
                field: "fecha_fin",
                operator: "gte",
                value: dateFilter,
                type: "AND",
            },
        ],
        enabled: !!user.selectedGroup,
    });

    useEffect(() => {
        const durationInMs =
            parseFloat(animationDurationAbove?.current || "0") * 2000;
        const timeoutId = setTimeout(() => {
            if (dataTable) {
                const bannersByCurrentGroup = dataTable.data.filter(
                    (item) =>
                        item.especificaciones?.groups?.includes(user.selectedGroup) &&
                        item.especificaciones?.users?.includes(user.id),
                );
                const bannersAbove = bannersByCurrentGroup.filter(
                    (item) => item.propiedades.position === "top-center",
                );
                if (bannersAbove.length > numberBannersAbove + 1) {
                    setNumberBannersAbove(numberBannersAbove + 1);
                } else {
                    setNumberBannersAbove(0);
                }
            }
        }, durationInMs);

        return () => clearTimeout(timeoutId);
    }, [animationDurationAbove, dataTable, user.selectedGroup, numberBannersAbove]);

    useEffect(() => {
        const durationInMs =
            parseFloat(animationDurationBelow?.current || "0") * 2000;
        const timeoutId = setTimeout(() => {
            if (dataTable) {
                const bannersByCurrentGroup = dataTable.data.filter(
                    (item) =>
                        item.especificaciones?.groups?.includes(user.selectedGroup) &&
                        item.especificaciones?.users?.includes(user.id),
                );
                const bannersBelow = bannersByCurrentGroup.filter(
                    (item) => item.propiedades.position === "bottom-center",
                );
                if (bannersBelow.length > numberBannersBelow + 1) {
                    setNumberBannersBelow(numberBannersBelow + 1);
                } else {
                    setNumberBannersBelow(0);
                }
            }
        }, durationInMs);

        return () => clearTimeout(timeoutId);
    }, [animationDurationBelow, dataTable, user.selectedGroup, numberBannersBelow]);

    useEffect(() => {
        if (dataTable) {
            const bannersByCurrentGroup = dataTable.data.filter(
                (item) =>
                    item.especificaciones?.groups?.includes(user.selectedGroup) &&
                    item.especificaciones?.users?.includes(user.id),
            );
            const bannersAbove = bannersByCurrentGroup.filter(
                (item) => item.propiedades.position === "top-center",
            );

            setShowBannerAbove(bannersAbove.length > 0);
            if (bannersAbove.length > 0) {
                setCurrentBannerAbove({
                    color: bannersAbove[numberBannersAbove].propiedades.color,
                    icon: bannersAbove[numberBannersAbove].propiedades.icon,
                    message: bannersAbove[numberBannersAbove].descripcion,
                    place: bannersAbove[numberBannersAbove].propiedades?.siteToShow,
                });
                animationDurationAbove.current = `${20 + bannersAbove[numberBannersAbove].descripcion.length / 90}s`;
            }
        }
    }, [dataTable, user.selectedGroup, numberBannersAbove]);

    useEffect(() => {
        if (dataTable) {
            const bannersByCurrentGroup = dataTable.data.filter(
                (item) =>
                    item.especificaciones?.groups?.includes(user.selectedGroup) &&
                    item.especificaciones?.users?.includes(user.id),
            );
            const bannersBelow = bannersByCurrentGroup.filter(
                (item) => item.propiedades.position === "bottom-center",
            );

            setShowBannerBelow(bannersBelow.length > 0);

            if (bannersBelow.length > 0) {
                setCurrentBannerBelow({
                    color: bannersBelow[numberBannersBelow].propiedades.color,
                    icon: bannersBelow[numberBannersBelow].propiedades.icon,
                    message: bannersBelow[numberBannersBelow].descripcion,
                    place: bannersBelow[numberBannersBelow].propiedades?.siteToShow,
                });
                animationDurationBelow.current = `${20 + bannersBelow[numberBannersBelow].descripcion.length / 90}s`;
            }
        }
    }, [dataTable, user.selectedGroup, numberBannersBelow]);

    return {
        currentBannerBelow,
        showBannerBelow,
        animationDurationAbove,
        showBannerAbove,
        currentBannerAbove,
        animationDurationBelow,
    };
};

export default useBannersInformation;
