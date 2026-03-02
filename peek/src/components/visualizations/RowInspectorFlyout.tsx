import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";

import type { EsqlColumn } from "../../types";
import { copyToClipboard } from "../../utils/copyToClipboard";

interface Props {
  open: boolean;
  onClose: () => void;
  columns: EsqlColumn[];
  row: unknown[] | null;
}

export default function RowInspectorFlyout({ open, onClose, columns, row }: Props) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [showNullFields, setShowNullFields] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rowObject = useMemo(() => {
    const obj: Record<string, unknown> = {};
    if (row) {
      columns.forEach((col, i) => {
        obj[col.name] = row[i] ?? null;
      });
    }
    return obj;
  }, [columns, row]);

  const handleCopyJson = useCallback(() => {
    setCopyError(null);
    void copyToClipboard(JSON.stringify(rowObject, null, 2)).then((success) => {
      if (success) {
        setCopied(true);
        if (copyTimeoutRef.current) {
          clearTimeout(copyTimeoutRef.current);
        }
        copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
      } else {
        setCopied(false);
        setCopyError("Failed to copy JSON.");
      }
    });
  }, [rowObject]);

  const handleClose = useCallback(() => {
    setCopied(false);
    setShowNullFields(false);
    setSearchQuery("");
    setCopyError(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const rowFields = useMemo(() => {
    return columns.map((col, i) => ({ col, value: row ? row[i] : null }));
  }, [columns, row]);

  const nullFieldCount = useMemo(
    () => rowFields.filter((field) => field.value === null || field.value === undefined).length,
    [rowFields],
  );

  const visibleFields = useMemo(() => {
    if (showNullFields) {
      return rowFields;
    }
    return rowFields.filter((field) => field.value !== null && field.value !== undefined);
  }, [rowFields, showNullFields]);

  const filteredFields = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return visibleFields;
    }
    return visibleFields.filter(({ col, value }) => {
      const nameMatch = col.name.toLowerCase().includes(query);
      const typeMatch = col.type.toLowerCase().includes(query);
      const valueText =
        value === null || value === undefined
          ? "null"
          : typeof value === "object"
            ? JSON.stringify(value)
            : String(value);
      const valueMatch = valueText.toLowerCase().includes(query);
      return nameMatch || typeMatch || valueMatch;
    });
  }, [visibleFields, searchQuery]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: { width: { xs: "100%", sm: 480 }, display: "flex", flexDirection: "column" },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          flexShrink: 0,
          justifyContent: "space-between",
          alignItems: "center",
          py: 1.5,
          px: 2,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Typography variant="subtitle1" fontWeight={600}>
          Row Inspector
        </Typography>
        <Button
          size="small"
          onClick={() => setShowNullFields((prev) => !prev)}
          disabled={nullFieldCount === 0}
          sx={{ visibility: nullFieldCount > 0 ? "visible" : "hidden" }}
        >
          {showNullFields ? "Hide null fields" : `Show null fields (${nullFieldCount})`}
        </Button>
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <Tooltip title={copied ? "Copied!" : "Copy JSON"}>
            <IconButton size="small" onClick={handleCopyJson} aria-label="Copy JSON">
              {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={handleClose} aria-label="Close inspector">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
      <Box sx={{ py: 1, px: 2, borderBottom: 1, borderColor: "divider" }}>
        <TextField
          size="small"
          fullWidth
          label="Search fields"
          placeholder="Filter by field name or type"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {copyError && (
          <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
            {copyError}
          </Typography>
        )}
      </Box>

      {/* Field/value table */}
      <Box sx={{ flex: 1, overflow: "auto" }}>
        {row && filteredFields.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No matching fields
          </Typography>
        )}
        {row &&
          filteredFields.map(({ col, value }) => (
            <Box key={col.name} data-testid={`row-inspector-field-${col.name}`}>
              <Box sx={{ py: 1, px: 2 }}>
                <Box sx={{ display: "flex", gap: 1, alignItems: "baseline", mb: 0.5 }}>
                  <Typography variant="caption" fontWeight={600} noWrap sx={{ flexShrink: 0 }}>
                    {col.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.6 }}>
                    {col.type}
                  </Typography>
                </Box>
                {value === null || value === undefined ? (
                  <Typography variant="body2" color="text.disabled" sx={{ fontStyle: "italic" }}>
                    null
                  </Typography>
                ) : (
                  <Typography
                    variant="body2"
                    sx={{
                      wordBreak: "break-all",
                      whiteSpace: "pre-wrap",
                      fontFamily: "monospace",
                    }}
                  >
                    {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
                  </Typography>
                )}
              </Box>
              <Divider />
            </Box>
          ))}
      </Box>
    </Drawer>
  );
}
