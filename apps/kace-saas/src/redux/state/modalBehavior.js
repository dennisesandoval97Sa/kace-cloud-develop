import { createSlice } from "@reduxjs/toolkit";

const initialValues = {
    open: false,
    idSelected: null,
    canBeEdit: true,
};

export const modalBehaviorSlice = createSlice({
    name: "modalBehavior",
    initialState: initialValues,
    reducers: {
        setOpenModal: (state, action) => {
            state.open = action.payload;
        },
        setIdSelectedAndEnableEdit: (state, action) => {
            state.idSelected = action.payload;
            state.canBeEdit = true;
        },
        setIdSelectedAndDisableEdit: (state, action) => {
            state.idSelected = action.payload;
            state.canBeEdit = false;
        },
        setIdSelected: (state, action) => {
            state.idSelected = action.payload;
        },
        reset: () => initialValues,
    },
});

export const {
    setOpenModal,
    setIdSelectedAndEnableEdit,
    setIdSelectedAndDisableEdit,
    setIdSelected,
    reset,
} = modalBehaviorSlice.actions;

export default modalBehaviorSlice.reducer;
