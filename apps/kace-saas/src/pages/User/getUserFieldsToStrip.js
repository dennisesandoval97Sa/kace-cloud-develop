const COMMON_FIELDS = ["expiredCases", "intermediateCases", "notExpiredCases", "groups", "newUser", "filters", "token"];

export const getUserFieldsToStrip = (accountType) => {
    return String(accountType) === "2" ? COMMON_FIELDS : [...COMMON_FIELDS, "password"];
};
