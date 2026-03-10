import { matchPath } from "react-router-dom";

import { PAGE_PATHS, type PageId } from "../../routes/paths";

const PAGE_PATH_ENTRIES = Object.entries(PAGE_PATHS)
  .map(([pageId, page]) => ({ pageId: pageId as PageId, path: page.path }))
  .sort((a, b) => b.path.length - a.path.length);

export function getMatchedPageId(pathname: string): PageId | null {
  for (const entry of PAGE_PATH_ENTRIES) {
    if (matchPath({ path: entry.path, end: true }, pathname)) {
      return entry.pageId;
    }
  }
  return null;
}
