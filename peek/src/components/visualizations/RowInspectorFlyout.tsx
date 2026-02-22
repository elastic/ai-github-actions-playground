import { useState, useCallback, useMemo } from "react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import type { EsqlColumn } from "../../types";

interface Props {
  open: boolean;
  onClose: () => void;
  columns: EsqlColumn[];
  row: unknown[] | null;
}

export default function RowInspectorFlyout({ open, onClose, columns, row }: Props) {
  const [copied, setCopied] = useState(false);

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
    void navigator.clipboard.writeText(JSON.stringify(rowObject, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [rowObject]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: "100%", sm: 480 }, display: "flex", flexDirection: "column" },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <Typography variant="subtitle1" fontWeight={600}>
          Row Inspector
        </Typography>
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <Tooltip title={copied ? "Copied!" : "Copy JSON"}>
            <IconButton size="small" onClick={handleCopyJson} aria-label="Copy JSON">
              {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={onClose} aria-label="Close inspector">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Field/value table */}
      <Box sx={{ flex: 1, overflow: "auto" }}>
        {row &&
          columns.map((col, i) => (
            <Box key={col.name}>
              <Box sx={{ px: 2, py: 1 }}>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, mb: 0.25 }}>
                  <Typography variant="caption" fontWeight={600} noWrap sx={{ flexShrink: 0 }}>
                    {col.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.6 }}>
                    {col.type}
                  </Typography>
                </Box>
                {row[i] === null || row[i] === undefined ? (
                  <Typography variant="body2" color="text.disabled" sx={{ fontStyle: "italic" }}>
                    null
                  </Typography>
                ) : (
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: "monospace",
                      wordBreak: "break-all",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {typeof row[i] === "object" ? JSON.stringify(row[i], null, 2) : String(row[i])}
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
