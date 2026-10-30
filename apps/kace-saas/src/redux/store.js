import { configureStore } from "@reduxjs/toolkit";
import userSlice from "./state/user";
import statesSlice from "./state/states";
import clientIdSlice from "./state/client";
import nextCountItemsSlice from "./state/nextCountItemsSlice";
import generalSetupSlice from "./state/generalSetupSlice";
import applicationSelectedSlice from "./state/applicationSelectedSlice";
import bannerSlice from "./state/bannerSlice";
import modalBehaviorSlice from "./state/modalBehavior";
import filterCasesSlice from "./state/filterCases";
import groupInformationSlice from "./state/groupInformation";
import showGroupsSelectSlice from "./state/showGroupSelect";
import loadingCaseInformationSlice from "./state/loadingCaseInformation";
import myAgendaBehaviorSlice from "./state/myAgendaBehavior";

export default configureStore({
    reducer: {
        user: userSlice,
        states: statesSlice,
        clientId: clientIdSlice,
        nextCountItems: nextCountItemsSlice,
        generalSetup: generalSetupSlice,
        applicationSelected: applicationSelectedSlice,
        banner: bannerSlice,
        modalBehavior: modalBehaviorSlice,
        filterCases: filterCasesSlice,
        groupInformation: groupInformationSlice,
        showGroupsSelect: showGroupsSelectSlice,
        loadingCaseInformation: loadingCaseInformationSlice,
        myAgendaBehavior: myAgendaBehaviorSlice,
    },
});
