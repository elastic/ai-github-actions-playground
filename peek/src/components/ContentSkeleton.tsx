import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

type ContentSkeletonVariant = "table" | "cards" | "chart" | "list" | "detail-panel";

interface ContentSkeletonProps {
  variant: ContentSkeletonVariant;
}

export default function ContentSkeleton({ variant }: ContentSkeletonProps) {
  if (variant === "cards") {
    return (
      <Stack spacing={1.5}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 1,
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={90} />
          ))}
        </Box>
        <Skeleton variant="rounded" height={220} />
      </Stack>
    );
  }

  if (variant === "chart") {
    return (
      <Stack spacing={1.5}>
        <Skeleton variant="text" width="30%" height={28} />
        <Skeleton variant="rounded" height={260} />
      </Stack>
    );
  }

  if (variant === "list") {
    return (
      <Stack spacing={1}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={48} />
        ))}
      </Stack>
    );
  }

  if (variant === "detail-panel") {
    return (
      <Stack spacing={1.5}>
        <Skeleton variant="text" width="40%" height={32} />
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: 1,
          }}
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={72} />
          ))}
        </Box>
        <Skeleton variant="rounded" height={200} />
      </Stack>
    );
  }

  return (
    <Stack spacing={1}>
      <Skeleton variant="rounded" height={32} />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} variant="text" height={24} />
      ))}
    </Stack>
  );
}
