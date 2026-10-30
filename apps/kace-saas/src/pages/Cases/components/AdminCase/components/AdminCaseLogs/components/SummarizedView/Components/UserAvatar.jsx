import { Bot, User } from "lucide-react";
import PropTypes from "prop-types";

const UserAvatar = ({ isSystem }) => {
    const Icon = isSystem ? Bot : User;
    return (
        <Icon size={20} />
    );
};

UserAvatar.propTypes = {
    isSystem: PropTypes.bool.isRequired,
}

export default UserAvatar;
