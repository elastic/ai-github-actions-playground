import "@mui/material/styles";

declare module "@mui/material/styles" {
  interface TypeBackground {
    subtle: string;
    elevated: string;
  }

  interface Palette {
    border: {
      subtle: string;
      default: string;
      strong: string;
    };
  }

  interface PaletteOptions {
    border?: {
      subtle?: string;
      default?: string;
      strong?: string;
    };
  }
}
