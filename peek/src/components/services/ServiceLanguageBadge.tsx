import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";

interface ServiceLanguageBadgeProps {
  language: string;
}

interface LanguagePresentation {
  label: string;
  iconText: string;
  bgColor: string;
}

function normalizeLanguage(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function languagePresentation(language: string): LanguagePresentation {
  const normalized = normalizeLanguage(language);
  if (normalized.includes("python")) {
    return { label: "Python", iconText: "Py", bgColor: "#3776AB" };
  }
  if (normalized.includes("dotnet") || normalized.includes("csharp") || normalized === "net") {
    return { label: ".NET", iconText: ".N", bgColor: "#512BD4" };
  }
  if (normalized.includes("javascript") || normalized.includes("nodejs") || normalized === "node") {
    return { label: "Node.js", iconText: "JS", bgColor: "#5FA04E" };
  }
  if (normalized.includes("java")) {
    return { label: "Java", iconText: "Jv", bgColor: "#E76F00" };
  }
  if (normalized === "go" || normalized.includes("golang")) {
    return { label: "Go", iconText: "Go", bgColor: "#00ADD8" };
  }
  if (normalized.includes("ruby")) {
    return { label: "Ruby", iconText: "Rb", bgColor: "#CC342D" };
  }
  if (normalized.includes("php")) {
    return { label: "PHP", iconText: "PHP", bgColor: "#777BB4" };
  }
  if (normalized.length === 0 || normalized === "unknown") {
    return { label: "Unknown", iconText: "?", bgColor: "#546E7A" };
  }
  return {
    label: language,
    iconText: language.slice(0, 2).toUpperCase(),
    bgColor: "#607D8B",
  };
}

export default function ServiceLanguageBadge({ language }: ServiceLanguageBadgeProps) {
  const presentation = languagePresentation(language);
  return (
    <Chip
      size="small"
      variant="outlined"
      label={presentation.label}
      icon={
        <Box
          component="span"
          aria-hidden
          sx={{
            display: "inline-flex",
            justifyContent: "center",
            alignItems: "center",
            width: 18,
            height: 18,
            ml: 0.5,
            borderRadius: "50%",
            bgcolor: presentation.bgColor,
            color: "common.white",
            letterSpacing: 0.1,
            fontWeight: 700,
            fontSize: 9,
          }}
        >
          {presentation.iconText}
        </Box>
      }
    />
  );
}
