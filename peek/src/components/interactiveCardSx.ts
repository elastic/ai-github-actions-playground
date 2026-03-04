export const interactiveCardSx = {
  transition: "border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease",
  "&:hover": {
    boxShadow: 2,
    borderColor: "primary.main",
  },
};

export const interactiveCardSxWithBg = {
  ...interactiveCardSx,
  "&:hover": {
    ...interactiveCardSx["&:hover"],
    bgcolor: "action.hover",
  },
};
