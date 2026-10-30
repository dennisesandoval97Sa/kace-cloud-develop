import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    flowId: "",
    transitionId: "",
    states: [],
    classificationId: "",
    clientId: "",
    searchStates: false,
    resolutionCase: false,
    reference: 0,
    hasMoreOptions: true,
    caseId: "",
    descriptionCaseId: "",
    descriptionCaseText: "",
    isCreatedCases: true,
    isRefrech: false,
    classificationSelectObject: {
        nivel1: "",
        nivel2: "",
        nivel3: "",
        nivel4: "",
        nivel5: "",
        nivel6: "",
        nivel7: "",
        nivel8: "",
        nivel9: "",
        nivel10: "",
    },
    changeOfTag: false,
    activeTab: "case",
    activeTabFormAux: "cliente",
    activeTabCaseByUserOrClient: "cases-agent",
    defaultClassificationValue: true,
    inputSearchFilter: true,
};

export const statesSlice = createSlice({
    name: "states",
    initialState,
    reducers: {
        setFlowId: (state, action) => {
            state.flowId = action.payload;
        },
        setStates: (state, action) => {
            state.states = action.payload;
        },
        setTransitionId: (state, action) => {
            state.transitionId = action.payload;
        },
        clearStates: (state) => {
            Object.assign(state, initialState);
        },
        setClassificationId: (state, action) => {
            state.classificationId = action.payload;
        },
        setSearchStates: (state, action) => {
            state.searchStates = action.payload;
        },
        setResolutionCase: (state, action) => {
            state.resolutionCase = action.payload;
        },
        setReference: (state, action) => {
            state.reference = action.payload;
        },
        setHasMoreOptions: (state, action) => {
            state.hasMoreOptions = action.payload;
        },
        setCaseId: (state, action) => {
            state.caseId = action.payload;
        },
        setDescriptionCaseId: (state, action) => {
            state.descriptionCaseId = action.payload;
        },
        setDescriptionCaseText: (state, action) => {
            state.descriptionCaseText = action.payload;
        },
        setIsCreatedCases: (state, action) => {
            state.isCreatedCases = action.payload;
        },
        setIsRefrech: (state, action) => {
            state.isRefrech = action.payload;
        },
        setClassificationSelectObject: (state, action) => {
            state.classificationSelectObject = action.payload;
        },
        setChangeOfTag: (state, action) => {
            state.changeOfTag = action.payload;
        },
        setActiveTab: (state, action) => {
            state.activeTab = action.payload;
        },
        setActiveTabFormAux: (state, action) => {
            state.activeTabFormAux = action.payload;
        },
        setActiveTabCaseByUserOrClient: (state, action) => {
            state.activeTabCaseByUserOrClient = action.payload;
        },
        setDefaultClassificationValue: (state, action) => {
            state.defaultClassificationValue = action.payload;
        },
        setInputSearchFilter: (state) => {
            state.inputSearchFilter = !state.inputSearchFilter;
        },
        setClientId: (state, action) => {
            state.clientId = action.payload;
        },
    },
});

export const {
    setFlowId,
    setStates,
    setTransitionId,
    clearStates,
    setClassificationId,
    setSearchStates,
    setResolutionCase,
    setReference,
    setHasMoreOptions,
    setCaseId,
    setDescriptionCaseId,
    setDescriptionCaseText,
    setIsCreatedCases,
    setIsRefrech,
    setClassificationSelectObject,
    setChangeOfTag,
    setActiveTab,
    setActiveTabFormAux,
    setActiveTabCaseByUserOrClient,
    setDefaultClassificationValue,
    setInputSearchFilter,
    setClientId,
} = statesSlice.actions;

export default statesSlice.reducer;
