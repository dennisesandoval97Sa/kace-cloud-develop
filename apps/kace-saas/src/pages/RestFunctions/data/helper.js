import { WSRestFunctionTypeEnum } from "../../../enums/WSRestFunctionTypeEnum";

export const getOptionsListFunctions = (t) => {
    const options = WSRestFunctionTypeEnum.toJson();
    return Object.keys(options).map((key) => ({
        value: WSRestFunctionTypeEnum[key].value,
        label: t(`restFunctions.form.label.${key}`),
    }));
};
