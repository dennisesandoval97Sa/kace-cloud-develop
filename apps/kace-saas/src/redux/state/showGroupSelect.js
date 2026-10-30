import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    showGroupsSelect: false,
};

const showGroupsSelectSlice = createSlice({
    name: "showGroupsSelect",
    initialState,
    reducers: {
        setShowGroupsSelect: (state, action) => {
            state.showGroupsSelect = action.payload;
        },
    },
});

export const { setShowGroupsSelect } = showGroupsSelectSlice.actions;
export default showGroupsSelectSlice.reducer;
