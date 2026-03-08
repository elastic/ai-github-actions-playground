import type { Breakpoint, Theme } from "@mui/material/styles";
import type { SystemStyleObject } from "@mui/system";

type MobileDrawerBreakpoint = Extract<Breakpoint, "sm" | "md">;

interface MobileDrawerPaperSxOptions {
  desktopBreakpoint: MobileDrawerBreakpoint;
  desktopWidth: number | string;
  padding?: number;
  backgroundColor?: string;
}

export function getMobileDrawerPaperSx({
  desktopBreakpoint,
  desktopWidth,
  padding,
  backgroundColor,
}: MobileDrawerPaperSxOptions): SystemStyleObject<Theme> {
  return {
    boxSizing: "border-box",
    width: { xs: "calc(100vw - 16px)", [desktopBreakpoint]: desktopWidth },
    maxWidth: "100vw",
    display: "flex",
    flexDirection: "column",
    ...(padding !== undefined ? { p: padding } : {}),
    ...(backgroundColor ? { backgroundColor } : {}),
  };
}

export function getMobileDrawerOffsetSx(
  desktopBreakpoint: MobileDrawerBreakpoint,
): (theme: Theme) => SystemStyleObject<Theme> {
  return (theme) => ({
    ...theme.mixins.toolbar,
    display: { xs: "block", [desktopBreakpoint]: "none" },
    flexShrink: 0,
  });
}
