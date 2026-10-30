export const getBadgeColor = ({ in_review, is_closed }) => {
    if (is_closed) {
        return "bg-red-100 text-red-800 border-red-200";
    }

    if (in_review) {
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
    }

    return "bg-blue-100 text-blue-800 border-blue-200";
};

export const getInteractionStatusKey = ({ in_review, is_closed }) => {
    if (is_closed) return "interactions.detail.closed";
    if (in_review) return "interactions.detail.underReview";
    return "interactions.detail.create";
};

export const getInteractionStatus = (interaction, t) => {
    const statusKey = getInteractionStatusKey(interaction);
    return t ? t(statusKey) : statusKey;
};

export const getTextStatusColor = ({ in_review, is_closed }) => {
    if (is_closed) return "text-red-800";
    if (in_review) return "text-yellow-600";
    return "text-blue-800";
};
