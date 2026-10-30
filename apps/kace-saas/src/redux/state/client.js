import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    isCreatedClient: true,
    isNew: false,
    dataClient: {},
    id: "",
};
export const clientIdSlice = createSlice({
    name: "clientId",
    initialState,
    reducers: {
        clearClientId: (state) => {
            state.id = "";
        },
        setIsCreatedClient: (state, action) => {
            state.isCreatedClient = action.payload;
        },
        setIsNew: (state, action) => {
            state.isNew = action.payload;
        },
        setDataClient: (state, action) => {
            state.dataClient = action.payload;
        },
    },
});

export const {
    clearClientId,
    setIsCreatedClient,
    setDataClient,
    setIsNew,
} = clientIdSlice.actions;

export default clientIdSlice.reducer;
