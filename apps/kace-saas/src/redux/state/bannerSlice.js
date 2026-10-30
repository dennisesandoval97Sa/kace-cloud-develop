import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    messageBanner: "Welcome to KACE Admin",
    showBanner: false,
    positionBanner: "top-center",
};

const bannerSlice = createSlice({
    name: "banner",
    initialState,
    reducers: {
        setMessageBanner: (state, action) => {
            state.messageBanner = action.payload;
        },
        setShowBanner: (state, action) => {
            state.showBanner = action.payload;
        },
        setPositionBanner: (state, action) => {
            state.positionBanner = action.payload;
        },
    },
});

export const { setMessageBanner, setShowBanner } = bannerSlice.actions;
export default bannerSlice.reducer;
