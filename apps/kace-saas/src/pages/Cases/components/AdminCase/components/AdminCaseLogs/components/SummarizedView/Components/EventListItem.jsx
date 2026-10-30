import PropTypes from "prop-types";

const EventListItem = ({ name, value, truncate = false }) => {
    return (
        <div className="flex gap-1 text-sm text-gray-700">
            <b>{name}: </b>
            <span className={truncate ? "truncate max-w-[160px] cursor-help" : ""}>{value}</span>
        </div>
    );
};

EventListItem.propTypes = {
    name: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
    truncate: PropTypes.bool,
};

export default EventListItem;
