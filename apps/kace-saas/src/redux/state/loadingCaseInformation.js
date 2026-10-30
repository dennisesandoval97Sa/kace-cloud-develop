import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    isLoadingInformationCase: false,
};

export const loadingCaseInformationSlice = createSlice({
    initialState,
    name: "loadingCaseInformation",
    reducers: {
        setLoadingCaseInformation: (state, action) => {
            state.isLoadingInformationCase = action.payload;
        },
    },
});

export const { setLoadingCaseInformation } = loadingCaseInformationSlice.actions;
export default loadingCaseInformationSlice.reducer;
