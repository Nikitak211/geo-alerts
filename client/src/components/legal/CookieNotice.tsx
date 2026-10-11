import React, { useState } from "react";
import { Box, Button, Link, Typography } from "@mui/material";

const STORAGE_KEY = "geoAlerts.storageNoticeAck.v1";

function alreadyAcknowledged(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Simple storage/cookie notice. geo-alerts uses no analytics, advertising or tracking cookies,
 * so no consent choices (or Google Consent Mode) are needed; only an informational notice.
 */
export function CookieNotice(): React.ReactElement | null {
  const [visible, setVisible] = useState(() => !alreadyAcknowledged());
  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* storage blocked: just hide for this session */
    }
    setVisible(false);
  };

  return (
    <Box
      role="region"
      aria-label="Cookie and storage notice"
      sx={{
        position: "fixed",
        insetInline: { xs: 8, sm: "auto" },
        insetInlineEnd: { sm: 16 },
        bottom: 16,
        maxWidth: { sm: 420 },
        zIndex: 2000,
        p: 2,
        borderRadius: 2,
        bgcolor: "#1d1f1c",
        color: "#f2f2f2",
        border: "1px solid rgba(255,255,255,0.24)",
        boxShadow: 6,
      }}
    >
      <Typography variant="body2" sx={{ mb: 1.5, lineHeight: 1.5 }}>
        Geo Alerts does not use analytics, advertising or tracking cookies. We only store a few
        technical settings on your device (for example map preferences) so the app works. See our{" "}
        <Link href="/privacy" underline="always" sx={{ color: "#e6ecdf" }}>privacy policy</Link>.{" "}
        <span lang="he" dir="rtl" style={{ display: "block", marginTop: 6 }}>
          האתר אינו משתמש בעוגיות למעקב, ניתוח או פרסום. נשמרות במכשיר רק הגדרות טכניות הנדרשות לפעולת האתר.
        </span>
      </Typography>
      <Button
        variant="contained"
        size="small"
        onClick={dismiss}
        sx={{ bgcolor: "#e6ecdf", color: "#1a1d1a", "&:hover": { bgcolor: "#ffffff" } }}
      >
        OK, got it
      </Button>
    </Box>
  );
}
