import { matchPath } from "react-router-dom";

import { PAGE_PATHS, type PageId } from "../../routes/paths";

function getPathSpecificity(path: string): {
  staticSegmentCount: number;
  dynamicSegmentCount: number;
} {
  const segments = path.split("/").filter(Boolean);
  const dynamicSegmentCount = segments.filter((segment) => segment.startsWith(":")).length;
  return {
    staticSegmentCount: segments.length - dynamicSegmentCount,
    dynamicSegmentCount,
  };
}

const PAGE_PATH_ENTRIES = Object.entries(PAGE_PATHS)
  .map(([pageId, page]) => ({
    pageId: pageId as PageId,
    path: page.path,
    ...getPathSpecificity(page.path),
  }))
  .sort((a, b) => {
    if (a.staticSegmentCount !== b.staticSegmentCount) {
      return b.staticSegmentCount - a.staticSegmentCount;
    }
    if (a.dynamicSegmentCount !== b.dynamicSegmentCount) {
      return a.dynamicSegmentCount - b.dynamicSegmentCount;
    }
    return b.path.length - a.path.length;
  });

export function getMatchedPageId(pathname: string): PageId | null {
  for (const entry of PAGE_PATH_ENTRIES) {
    if (matchPath({ path: entry.path, end: true }, pathname)) {
      return entry.pageId;
    }
  }
  return null;
}
