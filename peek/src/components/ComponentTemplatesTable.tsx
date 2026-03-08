import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import DescriptionIcon from "@mui/icons-material/Description";

import type { ComponentTemplateRow } from "../services/es";

import EmptyState from "./EmptyState";
import type { CompTplSortField, SortDirection } from "./templatesSortUtils";

interface ComponentTemplatesTableProps {
  loading: boolean;
  componentTemplatesCount: number;
  filteredTemplates: ComponentTemplateRow[];
  sortField: CompTplSortField;
  sortDirection: SortDirection;
  search: string;
  showSystem: boolean;
  onSort: (field: CompTplSortField) => void;
  onSelectTemplate: (name: string) => void;
}

export default function ComponentTemplatesTable({
  loading,
  componentTemplatesCount,
  filteredTemplates,
  sortField,
  sortDirection,
  search,
  showSystem,
  onSort,
  onSelectTemplate,
}: ComponentTemplatesTableProps) {
  return (
    <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
      <TableContainer>
        <Table size="small" stickyHeader aria-label="Component templates">
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sortField === "name"}
                  direction={sortField === "name" ? sortDirection : "asc"}
                  onClick={() => onSort("name")}
                >
                  Name
                </TableSortLabel>
              </TableCell>
              <TableCell>Includes</TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === "version"}
                  direction={sortField === "version" ? sortDirection : "asc"}
                  onClick={() => onSort("version")}
                >
                  Version
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === "usedByCount"}
                  direction={sortField === "usedByCount" ? sortDirection : "asc"}
                  onClick={() => onSort("usedByCount")}
                >
                  Used By
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && componentTemplatesCount === 0 && (
              <TableRow>
                <TableCell colSpan={4} sx={{ py: 0, border: 0 }}>
                  <LinearProgress />
                </TableCell>
              </TableRow>
            )}
            {filteredTemplates.map((template) => (
              <TableRow
                key={template.name}
                hover
                onClick={() => onSelectTemplate(template.name)}
                sx={{ cursor: "pointer" }}
              >
                <TableCell>
                  <ButtonBase
                    component="span"
                    onClick={() => onSelectTemplate(template.name)}
                    aria-label={`View component template ${template.name}`}
                    sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                  >
                    {template.name}
                  </ButtonBase>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    {template.hasMappings && (
                      <Chip label="Mappings" size="small" variant="outlined" />
                    )}
                    {template.hasSettings && (
                      <Chip label="Settings" size="small" variant="outlined" />
                    )}
                    {template.hasAliases && (
                      <Chip label="Aliases" size="small" variant="outlined" />
                    )}
                    {!template.hasMappings && !template.hasSettings && !template.hasAliases && "—"}
                  </Box>
                </TableCell>
                <TableCell>{template.version}</TableCell>
                <TableCell>{template.usedByCount}</TableCell>
              </TableRow>
            ))}
            {!loading && filteredTemplates.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} sx={{ border: 0 }}>
                  <EmptyState
                    size="small"
                    icon={<DescriptionIcon sx={{ fontSize: 28 }} />}
                    heading="No component templates found"
                    description={
                      search || !showSystem
                        ? 'Try adjusting your filters or enable "Show system templates".'
                        : "No component templates configured."
                    }
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
