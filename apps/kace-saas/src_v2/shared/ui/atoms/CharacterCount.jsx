import PropTypes from "prop-types";

export const CharacterCount = ({ current, max, id }) => (
    <span id={id} data-testid={id} className="text-sm text-muted-foreground">
        {current} / {max}
    </span>
);

CharacterCount.propTypes = {
    current: PropTypes.number.isRequired,
    max: PropTypes.number.isRequired,
    id: PropTypes.string.isRequired,
};
