import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    configAdmin: null,
    configAgent: null,
    idConfig: null,
};

const generalSetupSlice = createSlice({
    name: "generalSetup",
    initialState,
    reducers: {
        setGeneralSetupAdmin(state, action) {
            state.configAdmin = action.payload;
        },
        setGeneralSetupAgent(state, action) {
            state.configAgent = action.payload;
        },
        setConfigId(state, action) {
            state.idConfig = action.payload;
        },
    },
});

export const { setGeneralSetupAdmin, setGeneralSetupAgent, setConfigId } = generalSetupSlice.actions;
export default generalSetupSlice.reducer;
