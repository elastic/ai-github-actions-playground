import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import MiscellaneousServicesIcon from "@mui/icons-material/MiscellaneousServices";

interface K8sServiceLinksProps {
  serviceNames: string[];
}

export default function K8sServiceLinks({ serviceNames }: K8sServiceLinksProps) {
  const navigate = useNavigate();
  const uniqueServiceNames = Array.from(new Set(serviceNames));

  return (
    <Paper variant="outlined" sx={{ overflow: "auto" }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Linked Services
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {uniqueServiceNames.length} service{uniqueServiceNames.length !== 1 ? "s" : ""} detected
          in trace data
        </Typography>
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, p: 2 }}>
        {uniqueServiceNames.map((name) => (
          <Chip
            key={name}
            label={name}
            icon={<MiscellaneousServicesIcon />}
            variant="outlined"
            clickable
            onClick={() => navigate(`/services/${encodeURIComponent(name)}`)}
          />
        ))}
      </Box>
    </Paper>
  );
}
