import DetailSurface from "./DetailSurface";

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  ariaLabel?: string;
  width?: number;
  children: React.ReactNode;
}

/**
 * Thin wrapper around {@link DetailSurface} kept for backward-compatibility.
 * New code should use `DetailSurface` directly.
 */
export default function DetailDrawer({
  open,
  onClose,
  title,
  ariaLabel,
  width = 560,
  children,
}: DetailDrawerProps) {
  return (
    <DetailSurface open={open} onClose={onClose} title={title} ariaLabel={ariaLabel} width={width}>
      {children}
    </DetailSurface>
  );
}
