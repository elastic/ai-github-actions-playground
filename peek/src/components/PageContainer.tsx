import Box from "@mui/material/Box";

interface PageContainerProps {
  gap?: number;
  children: React.ReactNode;
}

export default function PageContainer({ gap = 1, children }: PageContainerProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap, height: "100%", minHeight: 0 }}>
      {children}
    </Box>
  );
}
