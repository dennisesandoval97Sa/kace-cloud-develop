import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    name: "",
    id: "",
};

const groupInformationSlice = createSlice({
    initialState,
    name: "groupInformation",
    reducers: {
        setGroupInformation: (state, action) => {
            state.name = action.payload.name;
            state.id = action.payload.id;
        },
    },
});

export const { setGroupInformation } = groupInformationSlice.actions;
export default groupInformationSlice.reducer;
