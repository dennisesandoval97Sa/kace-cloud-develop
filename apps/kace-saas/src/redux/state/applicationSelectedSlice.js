import { TYPE_APPLICATION } from "@kace/utils";
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    currentApplication: TYPE_APPLICATION.ADMIN,
};

const applicationSelectedSlice = createSlice({
    name: "applicationSelected",
    initialState,
    reducers: {
        setApplicationSelected: (state, action) => {
            state.currentApplication = action.payload;
        },
    },
});

export const { setApplicationSelected } = applicationSelectedSlice.actions;
export default applicationSelectedSlice.reducer;
