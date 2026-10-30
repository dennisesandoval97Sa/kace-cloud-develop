import React from "react";
import PropTypes from "prop-types";
import MultiSelect from "@/componentsV2/core/MultiSelect";
import useMultiSelectUsers from "./hooks/useMultiSelectUsers";

const MultiSelectUsers = ({ initialUsersValues = [], setUsersData = () => {} }) => {
    const {
        usersData,
        selectedUsersData,
        usersDataIsLoading,
        inifiniteUsersDataIsFetchingNextPage,
        onSelectUser,
        onSelectedAllUsers,
        onDeselectAllUsers,
        onInputChange,
        fetchNextUsersPage,
    } = useMultiSelectUsers(initialUsersValues, setUsersData);

    return (
        <MultiSelect
            options={usersData}
            selectedData={selectedUsersData}
            isLoading={usersDataIsLoading}
            isFetchingNextPage={inifiniteUsersDataIsFetchingNextPage}
            onSelectOption={onSelectUser}
            onSelectedAll={onSelectedAllUsers}
            showDeselectAll
            onDeselectAll={onDeselectAllUsers}
            onInputChange={onInputChange}
            fetchNextPage={fetchNextUsersPage}
        />
    );
};

MultiSelectUsers.propTypes = {
    initialUsersValues: PropTypes.array,
    setUsersData: PropTypes.func,
};

export default MultiSelectUsers;
