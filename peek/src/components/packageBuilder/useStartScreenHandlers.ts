import { useCallback, useState } from "react";

import { usePackageBuilderStore } from "../../store/usePackageBuilderStore";
import type { PackageBuilderData } from "../../types/packageBuilder";
import {
  exportPackageToDirectory,
  supportsDirectoryExport,
} from "../../services/packageBuilder/exportPackage";
import {
  importFromDirectoryHandle,
  importFromZip,
  importFromFolder,
} from "../../services/packageBuilder/importPackage";

async function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  return (
    window as unknown as {
      showDirectoryPicker: (opts: { mode: string }) => Promise<FileSystemDirectoryHandle>;
    }
  ).showDirectoryPicker({ mode: "readwrite" });
}

export function useStartScreenHandlers() {
  const reset = usePackageBuilderStore((s) => s.reset);
  const linkDir = usePackageBuilderStore((s) => s.linkDir);
  const loadPackage = usePackageBuilderStore((s) => s.loadPackage);
  const setIsLoaded = usePackageBuilderStore((s) => s.setIsLoaded);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const handleNew = async () => {
    setError(null);
    setStarting(true);
    try {
      const handle = await pickDirectory();
      reset();
      linkDir(handle);
      setIsLoaded(true);
      const freshData = usePackageBuilderStore.getState();
      await exportPackageToDirectory(freshData, handle);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  };

  const handleOpenDisk = async () => {
    setError(null);
    setStarting(true);
    try {
      const handle = await pickDirectory();
      const result = await importFromDirectoryHandle(handle);
      loadPackage(result.data);
      linkDir(handle);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  };

  const handleGitHubImportComplete = useCallback(
    async (data: PackageBuilderData) => {
      if (!supportsDirectoryExport()) return;
      try {
        const handle = await pickDirectory();
        await exportPackageToDirectory(data, handle);
        linkDir(handle);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [linkDir],
  );

  const handleZipUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setError(null);
      setStarting(true);
      try {
        const result = await importFromZip(file);
        loadPackage(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setStarting(false);
        e.target.value = "";
      }
    },
    [loadPackage],
  );

  const handleFolderUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      setError(null);
      setStarting(true);
      try {
        const result = await importFromFolder(files);
        loadPackage(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setStarting(false);
        e.target.value = "";
      }
    },
    [loadPackage],
  );

  return {
    error,
    starting,
    handleNew,
    handleOpenDisk,
    handleGitHubImportComplete,
    handleZipUpload,
    handleFolderUpload,
  };
}
