export const css = `
@keyframes alertBlink {
  0%   { background-color: #ff3b3b; }
  50%  { background-color: #ffffff; }
  100% { background-color: #ff3b3b; }
}
@keyframes alertShake {
  0%   { transform: translateX(0); }
  10%  { transform: translateX(-2px); }
  20%  { transform: translateX(3px); }
  30%  { transform: translateX(-4px); }
  40%  { transform: translateX(4px); }
  50%  { transform: translateX(-3px); }
  60%  { transform: translateX(2px); }
  70%  { transform: translateX(-2px); }
  80%  { transform: translateX(2px); }
  90%  { transform: translateX(-1px); }
  100% { transform: translateX(0); }
}

.alertCard {
  border: 1px solid #cfcfcf;
  border-left: 6px solid #cfcfcf;
  padding: 12px 12px;
  border-radius: 10px;
  margin-bottom: 10px;
  background: #fff;
  box-shadow: 0 6px 18px rgba(0,0,0,0.06);
}
.alertCard--new {
  border-color: #ff3b3b;
  border-left-color: #ff3b3b;
  animation: alertBlink 0.7s linear infinite, alertShake 0.7s ease-in-out infinite;
}

.alertHeader { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.badge { font-weight: 700; font-size: 12px; padding: 4px 8px; border-radius: 999px; background: #111; color: #fff; }
.badge--danger { background: #ff3b3b; color: #111; }
.title { font-weight: 800; font-size: 15px; }
.desc { font-size: 13px; opacity: 0.85; margin-bottom: 6px; }
.locations { font-size: 13px; }

.toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; align-items: center; }

button {
  padding: 8px 12px;
  border: 1px solid #cfcfcf;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  font-weight: 600;
}
button:disabled { opacity: 0.6; cursor: not-allowed; }

.status { font-size: 13px; opacity: 0.8; margin-left: 6px; }
`;
