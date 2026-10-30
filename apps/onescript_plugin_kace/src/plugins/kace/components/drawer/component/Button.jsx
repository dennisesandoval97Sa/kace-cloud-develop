export const Button = ({
  children,
  className,
  onClick,
  isDisabled = false,
  type = 'button',
}) => {
  return (
    <button
      type={type}
      className={className}
      onClick={onClick}
      disabled={isDisabled}
    >
      {children}
    </button>
  );
};
