import { useCallback } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import Link from "@mui/material/Link";

import type { HostRef } from "./hostTypes";

/** Builds the URL path for a host detail page. */
export function hostDetailPath(hostRef: HostRef): string {
  return `/hosts/${encodeURIComponent(hostRef.hostId)}`;
}

/**
 * Hook returning a navigation helper for host detail pages.
 * Use for imperative navigation from non-link contexts (e.g. table row clicks).
 */
export function useOpenHost() {
  const navigate = useNavigate();
  return useCallback(
    (hostRef: HostRef) => {
      navigate(hostDetailPath(hostRef));
    },
    [navigate],
  );
}

interface HostLinkProps {
  hostRef: HostRef;
  children?: React.ReactNode;
}

/** Consistent cross-surface link to host detail. */
export default function HostLink({ hostRef, children }: HostLinkProps) {
  return (
    <Link component={RouterLink} to={hostDetailPath(hostRef)} underline="hover">
      {children ?? hostRef.displayName}
    </Link>
  );
}
