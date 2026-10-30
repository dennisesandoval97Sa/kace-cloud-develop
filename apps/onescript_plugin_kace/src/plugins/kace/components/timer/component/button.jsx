export const Button = ({
  children,
  className,
  onClick,
  isDisabled = false,
  ...rest
}) => {
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={isDisabled}
      {...rest}
    >
      {children}
    </button>
  );
};
