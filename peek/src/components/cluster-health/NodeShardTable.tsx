import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

interface NodeShardRow {
  node: string;
  primary: number;
  replica: number;
  total: number;
}

interface NodeShardTableProps {
  rows: NodeShardRow[];
}

export default function NodeShardTable({ rows }: NodeShardTableProps) {
  if (rows.length === 0) return null;

  return (
    <>
      <Typography variant="body2" sx={{ mt: 3, mb: 1 }}>
        Shard Distribution by Node
      </Typography>
      <TableContainer>
        <Table size="small" aria-label="Shard Distribution by Node">
          <TableHead>
            <TableRow>
              <TableCell>Node</TableCell>
              <TableCell align="right">Primary</TableCell>
              <TableCell align="right">Replica</TableCell>
              <TableCell align="right">Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.node}>
                <TableCell>{row.node}</TableCell>
                <TableCell align="right">{row.primary}</TableCell>
                <TableCell align="right">{row.replica}</TableCell>
                <TableCell align="right">{row.total}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}
