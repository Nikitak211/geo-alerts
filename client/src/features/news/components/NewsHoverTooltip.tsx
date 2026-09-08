import { FC, memo } from "react";
import { Box, Typography } from "@mui/material";
import { tactical } from "../../../theme";
import { NEWS_TYPE_COLOR, NEWS_TYPE_LABEL } from "../newsTypes";
import type { NewsType } from "../types";

export type NewsHoverTooltipProps = {
  visible: boolean;
  x: number;
  y: number;
  type: NewsType;
  summary: string;
  domain: string;
  isCluster?: boolean;
  count?: number;
};

export const NewsHoverTooltip: FC<NewsHoverTooltipProps> = memo(
  function NewsHoverTooltip({
    visible,
    x,
    y,
    type,
    summary,
    domain,
    isCluster,
    count,
  }) {
    if (!visible) return null;

    return (
      <Box
        role="tooltip"
        aria-live="polite"
        sx={{
          position: "absolute",
          left: x + 14,
          top: y + 14,
          zIndex: 1400,
          pointerEvents: "none",
          maxWidth: 280,
          px: 1,
          py: 0.75,
          bgcolor: tactical.panel,
          border: `1px solid ${tactical.hairlineStrong}`,
          borderRadius: "3px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.45)",
        }}
      >
        <Box display="flex" alignItems="center" gap={0.75} mb={0.5}>
          <Box
            component="span"
            sx={{
              display: "inline-block",
              px: 0.75,
              py: 0.15,
              fontSize: "0.65rem",
              letterSpacing: "0.06em",
              fontWeight: 700,
              color: tactical.gunmetal,
              bgcolor: NEWS_TYPE_COLOR[type],
              borderRadius: "2px",
            }}
          >
            {NEWS_TYPE_LABEL[type]}
            {isCluster && count != null ? ` · ${count}` : ""}
          </Box>
        </Box>
        <Typography
          variant="caption"
          sx={{ display: "block", color: tactical.phosphor, lineHeight: 1.35 }}
        >
          {summary}
        </Typography>
        {domain ? (
          <Typography
            variant="caption"
            sx={{ display: "block", mt: 0.35, color: tactical.phosphorMuted }}
          >
            {domain}
          </Typography>
        ) : null}
      </Box>
    );
  }
);

NewsHoverTooltip.displayName = "NewsHoverTooltip";
