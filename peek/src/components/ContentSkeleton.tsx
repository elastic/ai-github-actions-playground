import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

type ContentSkeletonVariant = "table" | "cards" | "chart" | "chart-cell" | "list" | "detail-panel";

interface ContentSkeletonProps {
  variant: ContentSkeletonVariant;
  /** Optional height override, used primarily with the `chart-cell` variant. */
  height?: number;
}

export default function ContentSkeleton({ variant, height }: ContentSkeletonProps) {
  if (variant === "chart-cell") {
    return <Skeleton variant="rounded" height={height ?? 170} sx={{ borderRadius: 1 }} />;
  }

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
          {[...Array(4).keys()].map((n) => (
            <Skeleton key={n} variant="rounded" height={90} />
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
        {[...Array(5).keys()].map((n) => (
          <Skeleton key={n} variant="rounded" height={48} />
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
          {[...Array(3).keys()].map((n) => (
            <Skeleton key={n} variant="rounded" height={72} />
          ))}
        </Box>
        <Skeleton variant="rounded" height={200} />
      </Stack>
    );
  }

  return (
    <Stack spacing={1}>
      <Skeleton variant="rounded" height={32} />
      {[...Array(6).keys()].map((n) => (
        <Skeleton key={n} variant="text" height={24} />
      ))}
    </Stack>
  );
}
