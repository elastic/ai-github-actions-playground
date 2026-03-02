import "@mui/material/styles";

declare module "@mui/material/styles" {
  interface TypeBackground {
    subtle: string;
    elevated: string;
  }

  interface StatusPalette {
    success: string;
    warning: string;
    error: string;
    info: string;
    unknown: string;
    inProgress: string;
  }

  interface Palette {
    border: {
      subtle: string;
      default: string;
      strong: string;
    };
    status: StatusPalette;
  }

  interface PaletteOptions {
    border?: {
      subtle?: string;
      default?: string;
      strong?: string;
    };
    status?: Partial<StatusPalette>;
  }
}
