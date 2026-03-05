import { useMemo } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import FolderIcon from "@mui/icons-material/Folder";

import type { FieldInfo } from "../../services/es";
import { useNamespaceSummaries } from "../../hooks/useNamespaceSummaries";
import EmptyState from "../EmptyState";

import { metricNamespaceOf } from "./exploreUtils";
import { classifyFieldVisual, getFieldVisualIcon } from "./fieldVisuals";

interface Props {
  fields: FieldInfo[];
  indexPattern: string;
  onSelectNamespace: (namespace: string) => void;
}

export default function NamespaceLanding({ fields, indexPattern, onSelectNamespace }: Props) {
  const HIDDEN_NAMESPACE = "metrics";
  const namespacesWithCounts = useMemo(() => {
    const metricFields = fields.filter((f) => f.metricType !== "unknown");
    const byNs = new Map<string, FieldInfo[]>();
    for (const f of metricFields) {
      const ns = metricNamespaceOf(f.name);
      const list = byNs.get(ns) ?? [];
      list.push(f);
      byNs.set(ns, list);
    }
    return Array.from(byNs.entries())
      .filter(([namespace]) => namespace !== HIDDEN_NAMESPACE)
      .map(([namespace, list]) => ({
        namespace,
        metricCount: list.length,
        sampleMetricNames: list.slice(0, 15).map((f) => f.name),
        sampleFields: list.slice(0, 5),
      }))
      .sort((a, b) => b.metricCount - a.metricCount);
  }, [fields]);

  const namespaceInfos = useMemo(
    () =>
      namespacesWithCounts.map((n) => ({
        namespace: n.namespace,
        metricCount: n.metricCount,
        sampleMetricNames: n.sampleMetricNames,
      })),
    [namespacesWithCounts],
  );

  const { summaries, loading } = useNamespaceSummaries(
    namespaceInfos,
    namespacesWithCounts.length > 0,
  );

  if (namespacesWithCounts.length === 0) {
    return (
      <EmptyState
        icon={<FolderIcon sx={{ mb: 0.5, color: "text.secondary", fontSize: 48 }} />}
        heading="No metric namespaces found"
        description={`No metric fields found for index pattern "${indexPattern}". Add metrics data or try a different index pattern.`}
        addDataHref="/add-data"
      />
    );
  }

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 1.5,
        p: 1,
      }}
    >
      {namespacesWithCounts.map(({ namespace, metricCount, sampleFields }) => {
        const summary = summaries[namespace];
        const firstField = sampleFields[0];
        const fieldVisual = firstField
          ? classifyFieldVisual(firstField.name, firstField.metricType)
          : null;

        return (
          <Paper
            key={namespace}
            variant="outlined"
            sx={{
              overflow: "hidden",
              transition: "border-color 0.2s, box-shadow 0.2s",
              "&:hover": {
                boxShadow: 1,
                borderColor: "primary.main",
              },
            }}
          >
            <ButtonBase
              onClick={() => onSelectNamespace(namespace)}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                width: "100%",
                p: 1.5,
                textAlign: "left",
                "&:focus-visible": {
                  outline: "2px solid",
                  outlineColor: "primary.main",
                  outlineOffset: 2,
                },
              }}
            >
              <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1 }}>
                {fieldVisual && getFieldVisualIcon(fieldVisual, 20)}
                <Typography variant="subtitle1" fontWeight={600}>
                  {namespace}
                </Typography>
                <Box
                  component="span"
                  sx={{
                    ml: "auto",
                    py: 0.5,
                    px: 1,
                    borderRadius: 1,
                    bgcolor: "action.hover",
                    color: "text.secondary",
                    fontWeight: 600,
                    fontSize: "0.75rem",
                  }}
                >
                  {metricCount} {metricCount === 1 ? "metric" : "metrics"}
                </Box>
              </Box>
              {loading ? (
                <Skeleton variant="rounded" height={36} sx={{ borderRadius: 1 }} />
              ) : summary ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    display: "-webkit-box",
                    overflow: "hidden",
                    lineHeight: 1.5,
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 2,
                  }}
                >
                  {summary}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.disabled" fontStyle="italic">
                  Sample: {sampleFields.map((f) => f.name.split(".").pop() ?? f.name).join(", ")}
                </Typography>
              )}
            </ButtonBase>
          </Paper>
        );
      })}
    </Box>
  );
}
