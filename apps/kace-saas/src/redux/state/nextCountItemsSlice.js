import { createSlice } from "@reduxjs/toolkit";

export const nextCountItemsSlice = createSlice({
    name: "nextCountItems",
    initialState: {
        value: 0,
    },
    reducers: {
        setNextCountItems: (state, action) => {
            state.value = action.payload;
        },
        incrementNextCountItems: (state) => {
            state.value += 100;
        },
    },
});

export const { setNextCountItems, incrementNextCountItems } = nextCountItemsSlice.actions;

export default nextCountItemsSlice.reducer;
