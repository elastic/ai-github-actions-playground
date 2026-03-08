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

import type { IndexTemplateRow } from "../services/es";

import EmptyState from "./EmptyState";
import type { IndexTplSortField, SortDirection } from "./templatesSortUtils";

interface IndexTemplatesTableProps {
  loading: boolean;
  indexTemplatesCount: number;
  filteredTemplates: IndexTemplateRow[];
  sortField: IndexTplSortField;
  sortDirection: SortDirection;
  selectedTemplateName: string | null;
  search: string;
  dataStreamOnly: boolean;
  priorityMin: string;
  priorityMax: string;
  showSystem: boolean;
  onSort: (field: IndexTplSortField) => void;
  onSelectTemplate: (name: string) => void;
}

export default function IndexTemplatesTable({
  loading,
  indexTemplatesCount,
  filteredTemplates,
  sortField,
  sortDirection,
  selectedTemplateName,
  search,
  dataStreamOnly,
  priorityMin,
  priorityMax,
  showSystem,
  onSort,
  onSelectTemplate,
}: IndexTemplatesTableProps) {
  return (
    <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
      <TableContainer>
        <Table size="small" stickyHeader aria-label="Index templates">
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
              <TableCell>Index Patterns</TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === "priority"}
                  direction={sortField === "priority" ? sortDirection : "asc"}
                  onClick={() => onSort("priority")}
                >
                  Priority
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === "composedOfCount"}
                  direction={sortField === "composedOfCount" ? sortDirection : "asc"}
                  onClick={() => onSort("composedOfCount")}
                >
                  Composed Of
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === "dataStream"}
                  direction={sortField === "dataStream" ? sortDirection : "asc"}
                  onClick={() => onSort("dataStream")}
                >
                  Data Stream
                </TableSortLabel>
              </TableCell>
              <TableCell>Version</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && indexTemplatesCount === 0 && (
              <TableRow>
                <TableCell colSpan={6} sx={{ py: 0, border: 0 }}>
                  <LinearProgress />
                </TableCell>
              </TableRow>
            )}
            {filteredTemplates.map((template) => (
              <TableRow
                key={template.name}
                hover
                selected={template.name === selectedTemplateName}
                tabIndex={0}
                role="button"
                aria-label={`Open template details for ${template.name}`}
                onClick={() => onSelectTemplate(template.name)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
                    event.preventDefault();
                    onSelectTemplate(template.name);
                  }
                }}
                sx={{ cursor: "pointer" }}
              >
                <TableCell>
                  <ButtonBase
                    component="span"
                    onClick={() => onSelectTemplate(template.name)}
                    aria-label={`Open template details for ${template.name}`}
                    sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                  >
                    {template.name}
                  </ButtonBase>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                    {template.indexPatterns.map((pattern, index) => (
                      <Chip
                        key={`${pattern}-${index}`}
                        label={pattern}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </TableCell>
                <TableCell>{template.priority}</TableCell>
                <TableCell>{template.composedOfCount}</TableCell>
                <TableCell>
                  {template.dataStreamEnabled ? (
                    <Chip label="Yes" size="small" color="info" variant="outlined" />
                  ) : (
                    "No"
                  )}
                </TableCell>
                <TableCell>{template.version}</TableCell>
              </TableRow>
            ))}
            {!loading && filteredTemplates.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} sx={{ border: 0 }}>
                  <EmptyState
                    size="small"
                    icon={<DescriptionIcon sx={{ fontSize: 28 }} />}
                    heading="No index templates found"
                    description={
                      search || dataStreamOnly || priorityMin || priorityMax || !showSystem
                        ? 'Try adjusting your filters or enable "Show system templates".'
                        : "No index templates configured."
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
