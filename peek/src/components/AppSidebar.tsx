import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import DashboardIcon from "@mui/icons-material/Dashboard";
import SearchIcon from "@mui/icons-material/Search";
import ExploreIcon from "@mui/icons-material/Explore";
import TerminalIcon from "@mui/icons-material/Terminal";
import ChatIcon from "@mui/icons-material/Chat";
import DatasetIcon from "@mui/icons-material/Dataset";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import { useDashboardStore } from "../store/useDashboardStore";

type Page =
  | "dashboard"
  | "discover"
  | "dataStreams"
  | "explore"
  | "docs"
  | "console"
  | "chat"
  | "settings";

interface NavItem {
  label: string;
  page: Page;
  icon: React.ReactNode;
  requiresConnection?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Workspace",
    items: [
      {
        label: "Dashboard",
        page: "dashboard",
        icon: <DashboardIcon fontSize="small" />,
        requiresConnection: true,
      },
      {
        label: "Query Lab",
        page: "discover",
        icon: <SearchIcon fontSize="small" />,
        requiresConnection: true,
      },
      {
        label: "Metrics",
        page: "explore",
        icon: <ExploreIcon fontSize="small" />,
        requiresConnection: true,
      },
      {
        label: "Console",
        page: "console",
        icon: <TerminalIcon fontSize="small" />,
        requiresConnection: true,
      },
      {
        label: "Chat",
        page: "chat",
        icon: <ChatIcon fontSize="small" />,
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        label: "Data Streams",
        page: "dataStreams",
        icon: <DatasetIcon fontSize="small" />,
        requiresConnection: true,
      },
    ],
  },
  {
    label: "Help",
    items: [
      {
        label: "Docs",
        page: "docs",
        icon: <MenuBookIcon fontSize="small" />,
      },
    ],
  },
];

export default function AppSidebar() {
  const connected = useDashboardStore((s) => s.connected);
  const currentPage = useDashboardStore((s) => s.currentPage);
  const setCurrentPage = useDashboardStore((s) => s.setCurrentPage);

  return (
    <Box
      component="nav"
      aria-label="Main navigation"
      sx={{
        width: 200,
        flexShrink: 0,
        borderRight: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        display: "flex",
        flexDirection: "column",
        overflow: "auto",
      }}
    >
      {NAV_SECTIONS.map((section) => (
        <Box key={section.label} sx={{ pt: 1 }}>
          <Typography
            variant="caption"
            sx={{
              px: 2,
              py: 0.5,
              display: "block",
              color: "text.secondary",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontSize: "0.65rem",
            }}
          >
            {section.label}
          </Typography>
          <List dense disablePadding>
            {section.items.map((item) => {
              const isActive = currentPage === item.page;
              const isDisabled = item.requiresConnection && !connected;
              return (
                <ListItemButton
                  key={item.page}
                  selected={isActive}
                  disabled={isDisabled}
                  onClick={() => setCurrentPage(item.page)}
                  aria-current={isActive ? "page" : undefined}
                  sx={{
                    px: 2,
                    py: 0.75,
                    borderRadius: 1,
                    mx: 0.5,
                    "&.Mui-selected": {
                      bgcolor: "action.selected",
                      "&:hover": { bgcolor: "action.selected" },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32, color: isActive ? "primary.main" : "inherit" }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: "0.875rem",
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? "primary.main" : "inherit",
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      ))}
    </Box>
  );
}
