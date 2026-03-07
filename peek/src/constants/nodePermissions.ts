/**
 * Shared empty-state copy for node-related permission errors.
 *
 * All node surfaces that gate on the `monitor` cluster privilege
 * should use these constants so the messaging stays consistent.
 */

/** Heading shown when node data is unavailable due to missing privileges. */
export const NODE_PERMISSION_HEADING = "Node data unavailable";

/** Description shown when node data is unavailable due to missing privileges. */
export const NODE_PERMISSION_DESCRIPTION =
  "Node stats require the monitor cluster privilege. Contact your administrator to grant access.";

/** Tooltip hint for individual node stat cells that are unavailable. */
export const NODE_STAT_UNAVAILABLE_HINT =
  "Node stats unavailable — requires the monitor cluster privilege";
