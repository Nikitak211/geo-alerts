import React from "react";
import { Box, Container, Link, Typography } from "@mui/material";

export const CONTACT_URL = "https://github.com/Nikitak211/geo-alerts/issues";

export type LegalSection = { title: string; body: React.ReactNode };

/** Shared bilingual (Hebrew + English) layout for legal pages. */
export function LegalPage(props: {
  heTitle: string;
  enTitle: string;
  updated: string;
  he: LegalSection[];
  en: LegalSection[];
}): React.ReactElement {
  const render = (sections: LegalSection[], level: "h2" | "h3") =>
    sections.map((s) => (
      <Box component="section" key={s.title} sx={{ mb: 2.5 }}>
        <Typography component={level} variant="h6" gutterBottom>{s.title}</Typography>
        <Typography component="div" sx={{ lineHeight: 1.7 }}>{s.body}</Typography>
      </Box>
    ));
  return (
    <Box component="main" id="main-content" sx={{ minHeight: "100vh", bgcolor: "background.default", color: "text.primary", py: 4 }}>
      <Container
        maxWidth="md"
        sx={{
          "& a": { color: "#e6ecdf", textDecorationColor: "currentColor" },
          "& a:focus-visible": { outline: "2px solid #e6ecdf", outlineOffset: 2 },
          "& ul": { my: 1 },
        }}
      >
        <Box component="nav" aria-label="Site" sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 3 }}>
          <Link href="/" underline="always">← Back to the map / חזרה למפה</Link>
          <Link href="/privacy" underline="always">Privacy / פרטיות</Link>
          <Link href="/terms" underline="always">Terms / תנאי שימוש</Link>
          <Link href="/accessibility" underline="always">Accessibility / נגישות</Link>
        </Box>
        <section lang="he" dir="rtl" aria-labelledby="legal-he">
          <Typography id="legal-he" component="h1" variant="h4" gutterBottom>{props.heTitle}</Typography>
          {render(props.he, "h2")}
        </section>
        <Box component="hr" sx={{ my: 4, borderColor: "divider" }} />
        <section lang="en" dir="ltr" aria-labelledby="legal-en">
          <Typography id="legal-en" component="h2" variant="h4" gutterBottom>{props.enTitle}</Typography>
          {render(props.en, "h3")}
          <Typography variant="body2" sx={{ mt: 3 }}>Last updated: {props.updated}</Typography>
        </section>
      </Container>
    </Box>
  );
}
