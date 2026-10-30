import React from "react";
import PropTypes from "prop-types";
import MultiSelectPicker from "@kace_v2/shared/ui/organisms/MultiSelectPicker";
import useUsersOptions from "@kace_v2/shared/hooks/useUsersOptions.hook";

const useUsersPickerOptions = (initialValues, pageSize) => {
    const { users, usersOptions, setUsers, onSearch, fetchNextPage, hasNextPage, isFetchingNextPage } = useUsersOptions(
        initialValues,
        pageSize,
    );

    return {
        values: users,
        options: usersOptions,
        setValues: setUsers,
        onSearch,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    };
};

const MultiSelectUsers = ({
    className,
    initialUsers,
    error,
    pageSize,
    loadingMessage,
    searchErrorMessage,
    handlerChange = () => {},
}) => (
    <MultiSelectPicker
        label="Usuarios"
        placeholder="Seleccionar usuarios..."
        emptyMessage="No se encontraron usuarios"
        loadingMessage={loadingMessage}
        searchErrorMessage={searchErrorMessage}
        optionsHook={useUsersPickerOptions}
        initialValues={initialUsers}
        pageSize={pageSize}
        error={error}
        className={className}
        handlerChange={handlerChange}
    />
);

MultiSelectUsers.propTypes = {
    className: PropTypes.string,
    initialUsers: PropTypes.arrayOf(PropTypes.string),
    error: PropTypes.string,
    pageSize: PropTypes.number,
    loadingMessage: PropTypes.string,
    searchErrorMessage: PropTypes.string,
    handlerChange: PropTypes.func,
};

export default MultiSelectUsers;
