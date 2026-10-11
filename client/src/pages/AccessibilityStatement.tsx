import React from "react";
import { Box, Container, Link, Typography } from "@mui/material";

const UPDATED = "11 October 2026";

/** Accessibility statement (IS 5568 / WCAG 2.0 AA), bilingual Hebrew + English. Served at /accessibility. */
export function AccessibilityStatement(): React.ReactElement {
  return (
    <Box component="main" id="main-content" sx={{ minHeight: "100vh", bgcolor: "background.default", color: "text.primary", py: 4 }}>
      <Container maxWidth="md" sx={{ "& a": { color: "#e6ecdf", textDecorationColor: "currentColor" }, "& a:focus-visible": { outline: "2px solid #e6ecdf", outlineOffset: 2 } }}>
        <Link href="/" underline="always" sx={{ display: "inline-block", mb: 3 }}>
          ← Back to the map / חזרה למפה
        </Link>

        <section lang="he" dir="rtl" aria-labelledby="a11y-he">
          <Typography id="a11y-he" component="h1" variant="h4" gutterBottom>הצהרת נגישות</Typography>
          <Typography paragraph>
            אנו פועלים להנגיש את אתר Geo Alerts לאנשים עם מוגבלות, בהתאם לתקנות שוויון זכויות לאנשים עם מוגבלות
            (התאמות נגישות לשירות), התשע"ג-2013, ולתקן הישראלי ת"י 5568 המבוסס על הנחיות WCAG 2.0 ברמה AA.
          </Typography>
          <Typography component="h2" variant="h6" gutterBottom>מה הונגש</Typography>
          <Box component="ul" sx={{ pr: 3 }}>
            <li>ניווט מלא באמצעות מקלדת ומיקוד נראה לעין.</li>
            <li>מבנה כותרות ואזורי ציון (landmarks) לקוראי מסך.</li>
            <li>עדכוני התרעות חדשות מוכרזים לקוראי מסך (aria-live).</li>
            <li>יחסי ניגודיות צבעים לפי רמה AA, וסימון שפה (עברית/אנגלית) בתוכן.</li>
            <li>תמיכה בהגדלת טקסט עד 200% ובתצוגה במכשירים ניידים.</li>
          </Box>
          <Typography component="h2" variant="h6" gutterBottom>מגבלות ידועות</Typography>
          <Typography paragraph>
            המפה האינטראקטיבית (Cesium/Leaflet) היא רכיב גרפי ואינה נגישה במלואה לקוראי מסך. כל מידע ההתרעות המוצג
            במפה זמין גם כרשימת טקסט ברשימת ההתרעות. לגבי התרעות מצילות חיים יש להסתמך על פיקוד העורף ואפליקציית פיקוד העורף.
          </Typography>
          <Typography component="h2" variant="h6" gutterBottom>פנייה בנושא נגישות</Typography>
          <Typography paragraph>
            נתקלתם בבעיית נגישות? נשמח לשמוע: רכז הנגישות – ניקיטה קוגן, דרך{" "}
            <Link href="https://github.com/Nikitak211/geo-alerts/issues" underline="always">דף הפניות של הפרויקט</Link>.
            נשתדל להשיב תוך 14 ימים.
          </Typography>
          <Typography variant="body2">עודכן לאחרונה: 11.10.2026</Typography>
        </section>

        <Box component="hr" sx={{ my: 4, borderColor: "divider" }} />

        <section lang="en" dir="ltr" aria-labelledby="a11y-en">
          <Typography id="a11y-en" component="h2" variant="h4" gutterBottom>Accessibility statement</Typography>
          <Typography paragraph>
            Geo Alerts aims to conform to WCAG 2.0 level AA and Israeli Standard IS 5568. Keyboard navigation,
            screen-reader landmarks and headings, live announcements of new alerts, AA colour contrast, language
            markup and 200% text zoom are supported.
          </Typography>
          <Typography paragraph>
            Known limitation: the interactive 3D/2D map is a graphical component and is not fully accessible to
            screen readers; the same alert information is available as text in the alert feed. For life-safety
            alerts always rely on the official Home Front Command channels.
          </Typography>
          <Typography paragraph>
            Found a barrier? Contact the accessibility coordinator (Nikita Kogan) via the{" "}
            <Link href="https://github.com/Nikitak211/geo-alerts/issues" underline="always">project issue tracker</Link>.
            We aim to respond within 14 days.
          </Typography>
          <Typography variant="body2">Last updated: {UPDATED}</Typography>
        </section>
      </Container>
    </Box>
  );
}