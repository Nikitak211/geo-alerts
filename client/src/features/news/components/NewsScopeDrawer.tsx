import { FC, memo } from "react";
import { Box, Button, Link, Typography, Divider } from "@mui/material";
import { Paper } from "@mui/material";
import { tactical } from "../../../theme";
import { NEWS_TYPE_COLOR, NEWS_TYPE_LABEL } from "../newsTypes";
import type { NewsCluster, NewsItem } from "../types";
import type { NewsScopeSelection } from "../context/NewsSelectionContext";

export type NewsScopeDrawerProps = {
  selection: NewsScopeSelection;
  onClose: () => void;
  onSelectMember?: (item: NewsItem) => void;
};

function formatSeen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function LeafBody({ item }: { item: NewsItem }) {
  return (
    <>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <Box
          component="span"
          sx={{
            px: 0.75,
            py: 0.2,
            fontSize: "0.65rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: tactical.gunmetal,
            bgcolor: NEWS_TYPE_COLOR[item.type],
            borderRadius: "2px",
          }}
        >
          {NEWS_TYPE_LABEL[item.type]}
        </Box>
        <Typography variant="caption" color="text.secondary">
          {formatSeen(item.seenAt)}
        </Typography>
      </Box>
      <Typography
        variant="subtitle1"
        sx={{ color: tactical.phosphor, mb: 1, lineHeight: 1.3 }}
      >
        {item.title}
      </Typography>
      <Typography variant="body2" sx={{ color: tactical.phosphorMuted, mb: 1.5 }}>
        {item.summary}
      </Typography>
      {item.domain ? (
        <Typography variant="caption" display="block" mb={1}>
          Source: {item.domain}
        </Typography>
      ) : null}
      {item.url ? (
        <Link
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          sx={{ color: tactical.olive, fontSize: "0.8rem", fontWeight: 600 }}
        >
          Open source
        </Link>
      ) : null}
    </>
  );
}

function ClusterBody({
  cluster,
  focusItem,
  onSelectMember,
}: {
  cluster: NewsCluster;
  focusItem?: NewsItem;
  onSelectMember?: (item: NewsItem) => void;
}) {
  const primary = focusItem ?? cluster.items[0];
  return (
    <>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <Box
          component="span"
          sx={{
            px: 0.75,
            py: 0.2,
            fontSize: "0.65rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: tactical.gunmetal,
            bgcolor: NEWS_TYPE_COLOR[cluster.type],
            borderRadius: "2px",
          }}
        >
          {NEWS_TYPE_LABEL[cluster.type]} · {cluster.count}
        </Box>
      </Box>
      {primary ? <LeafBody item={primary} /> : null}
      <Divider sx={{ my: 1.5, borderColor: tactical.hairline }} />
      <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
        Cluster members
      </Typography>
      <Box
        sx={{
          maxHeight: 220,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 0.5,
        }}
      >
        {cluster.items.map((it) => (
          <Button
            key={it.id}
            size="small"
            onClick={() => onSelectMember?.(it)}
            sx={{
              justifyContent: "flex-start",
              textAlign: "left",
              color: tactical.phosphor,
              border: `1px solid ${tactical.hairline}`,
              borderRadius: "2px",
              textTransform: "none",
              fontSize: "0.72rem",
              py: 0.5,
            }}
          >
            {it.title}
          </Button>
        ))}
      </Box>
    </>
  );
}

export const NewsScopeDrawer: FC<NewsScopeDrawerProps> = memo(
  function NewsScopeDrawer({ selection, onClose, onSelectMember }) {
    if (!selection) return null;

    return (
      <Paper
        elevation={0}
        role="dialog"
        aria-label="News scope"
        sx={{
          position: "absolute",
          right: 12,
          top: 12,
          width: 340,
          maxWidth: "calc(100vw - 24px)",
          maxHeight: "calc(100% - 24px)",
          overflow: "auto",
          p: 2,
          zIndex: 1350,
          bgcolor: tactical.panel,
          border: `1px solid ${tactical.hairline}`,
          borderRadius: "3px",
        }}
      >
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          mb={1.5}
        >
          <Typography
            variant="subtitle2"
            sx={{ letterSpacing: "0.06em", color: tactical.phosphor }}
          >
            News scope
          </Typography>
          <Button
            size="small"
            onClick={onClose}
            aria-label="Close news scope"
            sx={{ minWidth: 0, color: tactical.phosphorMuted }}
          >
            Close
          </Button>
        </Box>
        {selection.mode === "leaf" ? (
          <LeafBody item={selection.item} />
        ) : (
          <ClusterBody
            cluster={selection.cluster}
            focusItem={selection.focusItem}
            onSelectMember={onSelectMember}
          />
        )}
      </Paper>
    );
  }
);

NewsScopeDrawer.displayName = "NewsScopeDrawer";
