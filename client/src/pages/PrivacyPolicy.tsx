import React from "react";
import { Link } from "@mui/material";
import { CONTACT_URL, LegalPage } from "./LegalPage";

/** Privacy policy. Served at /privacy. */
export function PrivacyPolicy(): React.ReactElement {
  return (
    <LegalPage
      heTitle="מדיניות פרטיות"
      enTitle="Privacy policy"
      updated="11 October 2026"
      he={[
        { title: "בקצרה", body: <p>Geo Alerts הוא אתר מידע ציבורי. אין בו הרשמה או חשבונות משתמש, אין תשלומים, ואין כלי אנליטיקה, פרסום או עוגיות מעקב. איננו מבקשים מכם מידע אישי.</p> },
        { title: "מידע שנאסף באופן טכני", body: <ul>
          <li>כתובת IP ופרטי בקשה בסיסיים (זמן, נתיב, דפדפן) נרשמים ביומני השרת ומשמשים להפעלת האתר, לאבטחה ולהגבלת קצב בקשות. הם נשמרים לזמן מוגבל ואינם משמשים לזיהוי או לפרופיל.</li>
          <li>האתר מוגש דרך Cloudflare, שמעבדת את הבקשות (כולל כתובת IP) לצורך העברה ואבטחה.</li>
        </ul> },
        { title: "אחסון במכשיר", body: <p>אנו שומרים ב-localStorage רק הגדרות טכניות (למשל העדפות מפה ואישור הודעת העוגיות). מידע זה נשאר במכשיר שלכם ואינו נשלח אלינו. ניתן למחוק אותו דרך הגדרות הדפדפן.</p> },
        { title: "שירותים חיצוניים", body: <ul>
          <li>נתוני התרעות: מידע ציבורי של פיקוד העורף (oref.org.il) המתקבל בצד השרת.</li>
          <li>אריחי מפה ונתוני תלת-ממד: הדפדפן שלכם טוען אותם ישירות מ-OpenStreetMap, Stadia Maps ו-Cesium ion, ולכן ספקים אלה מקבלים את כתובת ה-IP שלכם.</li>
          <li>חדשות: נתוני חדשות ציבוריים מ-GDELT המתקבלים בצד השרת.</li>
          <li>טלגרם: השרת מפרסם לערוץ טלגרם ציבורי צילומי מפה של התרעות (אזור ומיקום משוער). לא נשלח מידע אישי על המבקרים.</li>
        </ul> },
        { title: "זכויותיכם ויצירת קשר", body: <p>בהתאם לחוק הגנת הפרטיות, התשמ"א-1981, ניתן לפנות אלינו בכל שאלה או בקשה הנוגעת למידע דרך <Link href={CONTACT_URL} underline="always">דף הפניות של הפרויקט</Link>.</p> },
      ]}
      en={[
        { title: "Summary", body: <p>Geo Alerts is a public information site. There are no sign-ups or user accounts, no payments, and no analytics, advertising or tracking cookies. We do not ask you for personal information.</p> },
        { title: "Technical data", body: <ul>
          <li>Your IP address and basic request details (time, path, browser) appear in server logs and are used to run the site, for security and for rate limiting. They are kept for a limited time and not used to identify or profile you.</li>
          <li>The site is delivered through Cloudflare, which processes requests (including IP addresses) to route and protect them.</li>
        </ul> },
        { title: "Storage on your device", body: <p>We keep only technical settings in localStorage (for example map preferences and that you dismissed the cookie notice). This stays on your device and is not sent to us; you can clear it in your browser settings.</p> },
        { title: "Third-party services", body: <ul>
          <li>Alert data: public Home Front Command (oref.org.il) data, fetched by our server.</li>
          <li>Map tiles and 3D data: your browser loads them directly from OpenStreetMap, Stadia Maps and Cesium ion, so those providers receive your IP address.</li>
          <li>News: public GDELT news data, fetched by our server.</li>
          <li>Telegram: our server posts alert map screenshots (area and estimated location) to a public Telegram channel. No personal data about visitors is sent.</li>
        </ul> },
        { title: "Your rights and contact", body: <p>Under the Israeli Privacy Protection Law, 5741-1981, you can contact us with any question or request about data via the <Link href={CONTACT_URL} underline="always">project issue tracker</Link>.</p> },
      ]}
    />
  );
}
