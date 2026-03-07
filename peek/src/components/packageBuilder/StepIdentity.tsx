import { useCallback, useMemo, useRef } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Chip from "@mui/material/Chip";
import Autocomplete from "@mui/material/Autocomplete";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import Avatar from "@mui/material/Avatar";
import Stack from "@mui/material/Stack";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteIcon from "@mui/icons-material/Delete";
import { useShallow } from "zustand/react/shallow";

import { usePackageBuilderStore } from "../../store/usePackageBuilderStore";
import type { InsightSlotDefinition } from "../../types/insightSlots";
import { usePageSlotInsights } from "../../hooks/usePageSlotInsights";
import { InsightSlotProvider } from "../InsightSlotContext";
import InsightSlot from "../InsightSlot";
import {
  PACKAGE_CATEGORIES,
  type FormatVersion,
  type OwnerType,
  type SubscriptionLevel,
} from "../../types/packageBuilder";

const IDENTITY_SLOTS: readonly InsightSlotDefinition[] = [
  { slotId: "identity-name", label: "Package name field" },
  { slotId: "identity-title", label: "Package title field" },
  { slotId: "identity-description", label: "Package description field" },
  { slotId: "identity-version", label: "Version and format version fields" },
  { slotId: "identity-owner", label: "Owner GitHub team and type fields" },
  { slotId: "identity-categories", label: "Package categories field" },
  { slotId: "identity-conditions", label: "Kibana version and subscription fields" },
  { slotId: "identity-icon", label: "Package icon upload" },
];

const IDENTITY_SYSTEM_PROMPT = `You are reviewing form fields for an Elastic OTel input package identity.
Each field is a slot you can annotate with a brief suggestion.

**Elastic OTel Input Package Identity Rules:**
- **name** (identity-name): Lowercase with underscores only. The suffix "_input_otel" is appended automatically. User enters just the base name (e.g. "redis", "apache", "mysql"). If empty, this is the most important field to fill first.
- **title** (identity-title): Must follow the pattern "{Technology} OpenTelemetry Input Package". Derived from the name — if name is "redis", title should be "Redis OpenTelemetry Input Package". If empty or doesn't match the pattern, suggest the correct value.
- **description** (identity-description): One sentence: "Collect {Technology} {signal type} using OpenTelemetry Collector". If empty, suggest based on the name.
- **version** (identity-version): Semver format. "0.1.0" is correct for new packages. format_version should be "3.5.0" (standard) or "3.6.0" (if dynamic signal types needed).
- **owner** (identity-owner): github format is "org/team" — "elastic/ecosystem" is default for Elastic OTel packages. type is "elastic", "partner", or "community".
- **categories** (identity-categories): MUST include "opentelemetry". Should also include domain: "datastore" for databases/caches, "web" for web servers, "network" for network devices, "os_system" for OS-level, etc. Usually include "observability". 2-4 total.
- **conditions** (identity-conditions): kibana.version should be "^9.2.0" or later (OTel packages require Stack 9.2+). subscription is usually "basic".
- **icon** (identity-icon): SVG format preferred. Not required but recommended for published packages.

Only annotate fields that are empty, have wrong values, or could be improved. Skip fields that are correct.`;

const categoryOptions = PACKAGE_CATEGORIES;

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

export default function StepIdentity() {
  const identity = usePackageBuilderStore((s) => s.identity);
  const {
    setName,
    setTitle,
    setDescription,
    setVersion,
    setFormatVersion,
    setOwnerGithub,
    setOwnerType,
    setCategories,
    setKibanaVersion,
    setSubscription,
    setIcon,
  } = usePackageBuilderStore(
    useShallow((s) => ({
      setName: s.setName,
      setTitle: s.setTitle,
      setDescription: s.setDescription,
      setVersion: s.setVersion,
      setFormatVersion: s.setFormatVersion,
      setOwnerGithub: s.setOwnerGithub,
      setOwnerType: s.setOwnerType,
      setCategories: s.setCategories,
      setKibanaVersion: s.setKibanaVersion,
      setSubscription: s.setSubscription,
      setIcon: s.setIcon,
    })),
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleIconUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const [dataUrl, arrayBuffer] = await Promise.all([
          readAsDataURL(file),
          readAsArrayBuffer(file),
        ]);
        setIcon({
          name: file.name,
          dataUrl,
          rawBytes: new Uint8Array(arrayBuffer),
          mimeType: file.type || "image/svg+xml",
        });
      } catch (err) {
        console.warn("Failed to read icon file", err);
      } finally {
        // Reset so same file can be re-selected
        e.target.value = "";
      }
    },
    [setIcon],
  );

  const insightContext = useMemo(() => {
    if (!identity.name) return "";
    return `Package name: "${identity.name}"
Title: "${identity.title}"
Description: "${identity.description}"
Categories: ${JSON.stringify(identity.categories)}
Owner GitHub: "${identity.ownerGithub}"
Owner type: "${identity.ownerType}"
Version: "${identity.version}"
Format version: "${identity.formatVersion}"
Kibana version: "${identity.kibanaVersion}"
Subscription: "${identity.subscription}"
Has icon: ${identity.icon ? "yes" : "no"}`;
  }, [identity]);

  const { insights, loading, error, refresh } = usePageSlotInsights({
    context: insightContext,
    systemPrompt: IDENTITY_SYSTEM_PROMPT,
    cacheKey: `pkg-identity-slots::${hashString(insightContext)}`,
    slots: IDENTITY_SLOTS,
    enabled: Boolean(identity.name),
  });

  const displayName = identity.name
    ? identity.name.endsWith("_input_otel")
      ? identity.name
      : `${identity.name}_input_otel`
    : "";

  return (
    <InsightSlotProvider
      summary={null}
      insights={insights}
      loading={loading}
      error={error}
      refresh={refresh}
    >
      <Box sx={{ display: "flex", gap: 3 }}>
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 2.5 }}>
          <Typography variant="h6">Package Identity</Typography>

          <InsightSlot slotId="identity-name">
            <TextField
              label="Package name"
              value={identity.name}
              onChange={(e) => setName(e.target.value)}
              helperText={
                displayName
                  ? `Full name: ${displayName}`
                  : "Lowercase, underscores only. _input_otel suffix added automatically."
              }
              fullWidth
              size="small"
            />
          </InsightSlot>

          <InsightSlot slotId="identity-title">
            <TextField
              label="Title"
              value={identity.title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Redis OpenTelemetry Input Package"
              fullWidth
              size="small"
            />
          </InsightSlot>

          <InsightSlot slotId="identity-description">
            <TextField
              label="Description"
              value={identity.description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={3}
              fullWidth
              size="small"
            />
          </InsightSlot>

          <InsightSlot slotId="identity-version">
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                label="Version"
                value={identity.version}
                onChange={(e) => setVersion(e.target.value)}
                size="small"
                sx={{ width: 140 }}
              />
              <TextField
                label="Format version"
                value={identity.formatVersion}
                onChange={(e) => setFormatVersion(e.target.value as FormatVersion)}
                select
                size="small"
                sx={{ width: 160 }}
              >
                <MenuItem value="3.5.0">3.5.0</MenuItem>
                <MenuItem value="3.6.0">3.6.0</MenuItem>
              </TextField>
            </Box>
          </InsightSlot>

          <InsightSlot slotId="identity-owner">
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                label="Owner GitHub team"
                value={identity.ownerGithub}
                onChange={(e) => setOwnerGithub(e.target.value)}
                size="small"
                sx={{ flex: 1 }}
              />
              <TextField
                label="Owner type"
                value={identity.ownerType}
                onChange={(e) => setOwnerType(e.target.value as OwnerType)}
                select
                size="small"
                sx={{ width: 160 }}
              >
                <MenuItem value="elastic">Elastic</MenuItem>
                <MenuItem value="partner">Partner</MenuItem>
                <MenuItem value="community">Community</MenuItem>
              </TextField>
            </Box>
          </InsightSlot>

          <InsightSlot slotId="identity-categories">
            <Autocomplete
              multiple
              options={categoryOptions}
              value={identity.categories}
              onChange={(_, v) => setCategories(v)}
              renderInput={(params) => <TextField {...params} label="Categories" size="small" />}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, ...tagProps } = getTagProps({ index });
                  return <Chip key={key} label={option} size="small" {...tagProps} />;
                })
              }
              size="small"
              freeSolo
            />
          </InsightSlot>

          <InsightSlot slotId="identity-conditions">
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                label="Kibana version"
                value={identity.kibanaVersion}
                onChange={(e) => setKibanaVersion(e.target.value)}
                size="small"
                sx={{ flex: 1 }}
              />
              <TextField
                label="Subscription"
                value={identity.subscription}
                onChange={(e) => setSubscription(e.target.value as SubscriptionLevel)}
                select
                size="small"
                sx={{ width: 160 }}
              >
                <MenuItem value="basic">Basic</MenuItem>
                <MenuItem value="gold">Gold</MenuItem>
                <MenuItem value="platinum">Platinum</MenuItem>
                <MenuItem value="enterprise">Enterprise</MenuItem>
              </TextField>
            </Box>
          </InsightSlot>
        </Box>

        {/* Icon upload section */}
        <InsightSlot slotId="identity-icon">
          <Paper
            variant="outlined"
            sx={{
              width: 220,
              p: 2,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <Typography variant="subtitle1" color="text.secondary">
              Package Icon
            </Typography>
            {identity.icon ? (
              <Stack alignItems="center" spacing={1}>
                <Avatar
                  src={identity.icon.dataUrl}
                  variant="rounded"
                  sx={{ width: 80, height: 80, bgcolor: "transparent" }}
                />
                <Typography variant="caption" noWrap sx={{ maxWidth: 180 }}>
                  {identity.icon.name}
                </Typography>
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => setIcon(null)}
                >
                  Remove
                </Button>
              </Stack>
            ) : (
              <Stack alignItems="center" spacing={1}>
                <Button
                  sx={{
                    width: 80,
                    height: 80,
                    border: "2px dashed",
                    borderColor: "divider",
                    borderRadius: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 0,
                    p: 0,
                    "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadFileIcon color="action" />
                </Button>
                <Typography variant="caption" color="text.secondary">
                  SVG preferred
                </Typography>
                <Button size="small" onClick={() => fileInputRef.current?.click()}>
                  Upload
                </Button>
              </Stack>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".svg,.png,.jpg,.jpeg"
              hidden
              onChange={handleIconUpload}
            />
          </Paper>
        </InsightSlot>
      </Box>
    </InsightSlotProvider>
  );
}
