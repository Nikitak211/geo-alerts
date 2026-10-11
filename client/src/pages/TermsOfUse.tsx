import React from "react";
import { Link } from "@mui/material";
import { CONTACT_URL, LegalPage } from "./LegalPage";

/** Terms of use. Served at /terms. */
export function TermsOfUse(): React.ReactElement {
  return (
    <LegalPage
      heTitle="תנאי שימוש"
      enTitle="Terms of use"
      updated="11 October 2026"
      he={[
        { title: "אינו מקור רשמי", body: <p><strong>Geo Alerts אינו מערכת התרעה רשמית ואין להסתמך עליו לצורכי בטיחות.</strong> בכל מצב חירום יש לפעול לפי הנחיות פיקוד העורף, אפליקציית פיקוד העורף ואמצעי ההתרעה הרשמיים.</p> },
        { title: "דיוק המידע", body: <p>המידע מבוסס על נתונים ציבוריים של פיקוד העורף ועל מקורות חדשות, ועלול להתעכב, להיות חלקי או שגוי. מסלולים, אזורי שיגור ומיקומים המוצגים באתר הם הערכות חישוביות בלבד.</p> },
        { title: "שימוש מותר", body: <p>השימוש באתר חינמי ולמטרות מידע אישי. אין להעמיס על האתר, לעקוף את הגבלות הקצב או לנסות לפגוע באבטחתו.</p> },
        { title: "ערוץ הטלגרם", body: <p>האתר עשוי לפרסם צילומי מפה של התרעות בערוץ טלגרם ציבורי. אותן הסתייגויות חלות גם על תוכן זה.</p> },
        { title: "אחריות", body: <p>האתר מסופק "כמות שהוא" (AS IS), ללא אחריות מכל סוג. במידה המרבית המותרת בדין, איננו אחראים לכל נזק הנובע מהשימוש באתר או מהסתמכות עליו.</p> },
        { title: "קניין רוחני", body: <p>נתוני המפה © תורמי OpenStreetMap (ODbL) ושאר ספקי המפות לפי תנאיהם. קוד הפרויקט מופץ לפי הרישיון שבמאגר.</p> },
        { title: "שינויים, דין וסמכות", body: <p>נוכל לעדכן תנאים אלה מעת לעת. על התנאים יחול הדין הישראלי, וסמכות השיפוט הבלעדית נתונה לבתי המשפט בתל אביב-יפו. פניות: <Link href={CONTACT_URL} underline="always">דף הפניות של הפרויקט</Link>.</p> },
      ]}
      en={[
        { title: "Not an official source", body: <p><strong>Geo Alerts is not an official alert system and must not be relied on for safety.</strong> In any emergency follow the Home Front Command, its official app and other official warning channels.</p> },
        { title: "Accuracy", body: <p>Information comes from public Home Front Command data and news sources and may be delayed, incomplete or wrong. Trajectories, launch regions and locations shown are computational estimates only.</p> },
        { title: "Acceptable use", body: <p>The site is free and for personal informational use. Do not overload it, bypass rate limits or attempt to compromise its security.</p> },
        { title: "Telegram channel", body: <p>The site may post alert map screenshots to a public Telegram channel. The same disclaimers apply to that content.</p> },
        { title: "No warranty, limitation of liability", body: <p>The site is provided "as is", without warranties of any kind. To the maximum extent permitted by law, we are not liable for any damage arising from using or relying on it.</p> },
        { title: "Intellectual property", body: <p>Map data © OpenStreetMap contributors (ODbL) and other map providers under their terms. The project's code is distributed under the license in its repository.</p> },
        { title: "Changes, law and jurisdiction", body: <p>We may update these terms from time to time. They are governed by Israeli law, and the courts of Tel Aviv-Yafo have exclusive jurisdiction. Contact: <Link href={CONTACT_URL} underline="always">project issue tracker</Link>.</p> },
      ]}
    />
  );
}
