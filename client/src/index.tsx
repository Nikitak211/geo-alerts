import React from "react";
import ReactDOM from "react-dom/client";
import * as Cesium from "cesium";

import "cesium/Build/Cesium/Widgets/widgets.css";
import { Main } from "./Main";
import "./index.css";

Cesium.Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2MzA5YzVjMS1hZTVhLTQ3ZWItYjgxZi03NDE1ODczY2IxZGMiLCJpZCI6MTM3MDU2LCJpYXQiOjE2ODM0NDc1MDB9.HZYhRN5oGy_Yf3EKBxBNEKcS_ihgZwiMsC_QJflVKKg";

(window as any).CESIUM_BASE_URL = "/cesium/";

(window as any).Cesium = Cesium;

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);

root.render(
  <React.StrictMode>
    <Main />
  </React.StrictMode>,
);
