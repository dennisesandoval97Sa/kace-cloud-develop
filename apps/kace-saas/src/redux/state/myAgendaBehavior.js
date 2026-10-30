import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    isOpenMyAgenda: false,
};

export const myAgendaBehaviorSlice = createSlice({
    initialState,
    name: "myAgendaBehavior",
    reducers: {
        setMyAgendaBehavior: (state, action) => {
            state.isOpenMyAgenda = action.payload;
        },
    },
});

export const { setMyAgendaBehavior } = myAgendaBehaviorSlice.actions;
export default myAgendaBehaviorSlice.reducer;
