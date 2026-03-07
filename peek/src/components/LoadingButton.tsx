import Button, { type ButtonProps } from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";

interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
}

export default function LoadingButton({
  loading,
  disabled,
  children,
  startIcon,
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      {...props}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      startIcon={
        loading ? <CircularProgress size={14} color="inherit" aria-hidden="true" /> : startIcon
      }
    >
      {children}
    </Button>
  );
}
