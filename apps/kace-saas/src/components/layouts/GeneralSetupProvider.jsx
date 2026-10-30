import PropTypes from "prop-types";
import GroupConfiguration from "../../pages/GroupConfiguration/GroupConfiguration";
import { useAuth } from "../../cognito-auth/AuthContext";
import LoadingPage from "../core/LoaderPage/LoginLoaderPage";
import { GeneralErrorPage } from "../core/ErrorPage/GeneralErrorPage";
import SessionConflictDialog from "../core/SessionConflictDialog/SessionConflictDialog";
import { useSelector } from "react-redux";

const GeneralSetupProvider = ({ children = <></> }) => {
    const {
        isAuthenticated,
        userInformation,
        isLoadingUserInformation,
        isErrorUserInformation,
        refetch,
        hasErrorAuth,
        inactiveUser,
        isFingerprintError,
        logout,
        isSessionConflict,
        isSessionTakenOver,
        isSessionRejected,
        onConfirmTakeover,
        onRejectTakeover,
        dismissSessionRejected,
    } = useAuth();
    const configAdmin = useSelector((state) => state.generalSetup.configAdmin);

    const isOnLogoutPage = window.location.pathname === "/logout";

    if (isSessionConflict) {
        return <SessionConflictDialog onConfirm={onConfirmTakeover} onReject={onRejectTakeover} />;
    }

    if (isSessionRejected) {
        return (
            <GeneralErrorPage
                refetch={dismissSessionRejected}
                message="app.text.sessionRejected"
                buttonText="app.forms.close"
                showDefaultMessage={false}
            />
        );
    }

    if (isSessionTakenOver) {
        return <GeneralErrorPage refetch={logout} message="app.text.sessionTakenOver" showDefaultMessage={false} />;
    }

    if (inactiveUser) {
        return <GeneralErrorPage refetch={logout} message="app.text.inactiveUser" />;
    }

    if (hasErrorAuth) {
        return <GeneralErrorPage refetch={logout} message="app.text.userAuth" />;
    }

    if (isFingerprintError) {
        return (
            <GeneralErrorPage
                refetch={logout}
                message="app.text.fingerprintAuth"
                buttonText="app.title.signInAgain"
                showDefaultMessage={false}
            />
        );
    }

    if (!isAuthenticated && !isOnLogoutPage) {
        return <LoadingPage message="Cargando autenticación, por favor espere..." className="" />;
    }

    if (isLoadingUserInformation) {
        return <LoadingPage message="Cargando información del usuario, por favor espere..." className="" />;
    }

    if (userInformation && isAuthenticated && !configAdmin) {
        return <GroupConfiguration userInformation={userInformation} />;
    }

    if (isErrorUserInformation) {
        return <GeneralErrorPage refetch={refetch} />;
    }

    return <>{children}</>;
};

GeneralSetupProvider.propTypes = {
    configId: PropTypes.string,
    children: PropTypes.node,
};

export default GeneralSetupProvider;
