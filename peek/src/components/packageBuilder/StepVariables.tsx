import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import KeyIcon from "@mui/icons-material/Key";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import { usePackageBuilderStore } from "../../store/usePackageBuilderStore";
import {
  VARIABLE_TYPE_LABELS,
  type PackageVariable,
  type SelectOption,
  type VariableType,
} from "../../types/packageBuilder";

function VariableCard({
  variable,
  index,
  total,
  onUpdate,
  onRemove,
  onMove,
}: {
  variable: PackageVariable;
  index: number;
  total: number;
  onUpdate: (updates: Partial<PackageVariable>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const handleAddOption = () => {
    onUpdate({ options: [...variable.options, { text: "", value: "" }] });
  };

  const handleUpdateOption = (optIdx: number, field: keyof SelectOption, value: string) => {
    const options = [...variable.options];
    const prev = options[optIdx];
    if (!prev) return;
    options[optIdx] = { ...prev, [field]: value };
    onUpdate({ options });
  };

  const handleRemoveOption = (optIdx: number) => {
    onUpdate({ options: variable.options.filter((_, i) => i !== optIdx) });
  };

  const copyTag = `{{${variable.name}}}`;

  return (
    <Card variant="outlined" sx={{ position: "relative" }}>
      <CardContent sx={{ pb: "12px !important" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            <IconButton size="small" disabled={index === 0} onClick={() => onMove(-1)}>
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" disabled={index === total - 1} onClick={() => onMove(1)}>
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
          </Box>

          <TextField
            label="Variable name"
            value={variable.name}
            onChange={(e) => onUpdate({ name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
            size="small"
            sx={{ flex: 1 }}
          />

          <TextField
            label="Type"
            value={variable.type}
            onChange={(e) => onUpdate({ type: e.target.value as VariableType })}
            select
            size="small"
            sx={{ width: 180 }}
          >
            {(Object.entries(VARIABLE_TYPE_LABELS) as [VariableType, string][]).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>

          {variable.name && (
            <Tooltip title="Copy template tag">
              <Chip
                icon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
                label={copyTag}
                size="small"
                variant="outlined"
                onClick={() => navigator.clipboard.writeText(copyTag)}
                sx={{ fontFamily: "monospace", fontSize: 12 }}
              />
            </Tooltip>
          )}

          {variable.secret && (
            <Tooltip title="Auto-detected as secret">
              <KeyIcon fontSize="small" color="warning" />
            </Tooltip>
          )}

          <IconButton size="small" color="error" onClick={onRemove}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>

        <Box sx={{ display: "flex", gap: 2, mb: 1.5 }}>
          <TextField
            label="Title"
            value={variable.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            size="small"
            sx={{ flex: 1 }}
          />
          <TextField
            label="Description"
            value={variable.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            size="small"
            sx={{ flex: 2 }}
          />
        </Box>

        <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
          {variable.type === "bool" ? (
            <FormControlLabel
              control={
                <Switch
                  checked={variable.default === "true"}
                  onChange={(e) => onUpdate({ default: e.target.checked ? "true" : "false" })}
                  size="small"
                />
              }
              label="Default"
            />
          ) : (
            <TextField
              label="Default value"
              value={variable.default}
              onChange={(e) => onUpdate({ default: e.target.value })}
              size="small"
              type={variable.type === "integer" ? "number" : "text"}
              sx={{ width: 240 }}
            />
          )}

          <FormControlLabel
            control={<Switch checked={variable.required} onChange={(e) => onUpdate({ required: e.target.checked })} size="small" />}
            label="Required"
          />
          <FormControlLabel
            control={<Switch checked={variable.showUser} onChange={(e) => onUpdate({ showUser: e.target.checked })} size="small" />}
            label="Show user"
          />
          <FormControlLabel
            control={<Switch checked={variable.multi} onChange={(e) => onUpdate({ multi: e.target.checked })} size="small" />}
            label="Multi"
          />
          <FormControlLabel
            control={<Switch checked={variable.secret} onChange={(e) => onUpdate({ secret: e.target.checked })} size="small" />}
            label="Secret"
          />
        </Box>

        {/* Select options sub-editor */}
        {variable.type === "select" && (
          <Box sx={{ mt: 2 }}>
            <Divider sx={{ mb: 1.5 }} />
            <Typography variant="caption" color="text.secondary" gutterBottom display="block">
              Dropdown Options
            </Typography>
            <Stack spacing={1}>
              {variable.options.map((opt, optIdx) => (
                <Box key={optIdx} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  <TextField
                    label="Display text"
                    value={opt.text}
                    onChange={(e) => handleUpdateOption(optIdx, "text", e.target.value)}
                    size="small"
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="Value"
                    value={opt.value}
                    onChange={(e) => handleUpdateOption(optIdx, "value", e.target.value)}
                    size="small"
                    sx={{ flex: 1 }}
                  />
                  <IconButton size="small" onClick={() => handleRemoveOption(optIdx)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Button size="small" startIcon={<AddIcon />} onClick={handleAddOption} sx={{ alignSelf: "flex-start" }}>
                Add option
              </Button>
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default function StepVariables() {
  const variables = usePackageBuilderStore((s) => s.variables);
  const addVariable = usePackageBuilderStore((s) => s.addVariable);
  const removeVariable = usePackageBuilderStore((s) => s.removeVariable);
  const updateVariable = usePackageBuilderStore((s) => s.updateVariable);
  const moveVariable = usePackageBuilderStore((s) => s.moveVariable);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h6">Variables</Typography>
          <Typography variant="body2" color="text.secondary">
            Define configurable variables available in Fleet UI and your Handlebars template.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={addVariable} size="small">
          Add variable
        </Button>
      </Box>

      {variables.length > 0 && (
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", pb: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, lineHeight: "24px" }}>
            Template tags:
          </Typography>
          {variables
            .filter((v) => v.name)
            .map((v) => (
              <Chip
                key={v.name}
                label={`{{${v.name}}}`}
                size="small"
                variant="outlined"
                sx={{ fontFamily: "monospace", fontSize: 11 }}
                onClick={() => navigator.clipboard.writeText(`{{${v.name}}}`)}
              />
            ))}
        </Box>
      )}

      <Stack spacing={2}>
        {variables.map((variable, index) => (
          <VariableCard
            key={index}
            variable={variable}
            index={index}
            total={variables.length}
            onUpdate={(updates) => updateVariable(index, updates)}
            onRemove={() => removeVariable(index)}
            onMove={(dir) => moveVariable(index, index + dir)}
          />
        ))}
      </Stack>

      {variables.length === 0 && (
        <Box
          sx={{
            py: 6,
            textAlign: "center",
            border: "2px dashed",
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          <Typography color="text.secondary" gutterBottom>
            No variables defined yet.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Variables let users configure the OTel receiver (endpoint, credentials, intervals, etc.)
          </Typography>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={addVariable}>
            Add first variable
          </Button>
        </Box>
      )}
    </Box>
  );
}
