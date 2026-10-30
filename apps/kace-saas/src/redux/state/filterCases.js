import { createSlice } from "@reduxjs/toolkit";

const initialValues = {
    filter: null,
    currentColor: "",
    title: "Casos",
};

const filterCasesSlice = createSlice({
    name: "filterCases",
    initialState: initialValues,
    reducers: {
        setFilterCases: (state, action) => {
            state.filter = action.payload;
        },
        setCurrentColor: (state, action) => {
            state.currentColor = action.payload;
        },
        setTitle: (state, action) => {
            state.title = action.payload;
        },
        reset: () => initialValues,
    },
});

export const { setFilterCases, setCurrentColor, reset, setTitle } = filterCasesSlice.actions;

export default filterCasesSlice.reducer;
