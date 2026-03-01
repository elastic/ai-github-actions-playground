import { Component, type ErrorInfo, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            p: 4,
            minHeight: 200,
          }}
        >
          <Typography variant="h6" component="p">
            Something went wrong
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </Typography>
          <Button variant="outlined" size="small" onClick={this.handleReset}>
            Try Again
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
