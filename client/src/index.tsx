import React from "react";
import ReactDOM from "react-dom/client";
import * as Cesium from "cesium";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import "cesium/Build/Cesium/Widgets/widgets.css";
import { Main } from "./Main";
import { MapRenderPage } from "./render";
import { appTheme } from "./theme";
import { SignalRConnectionProvider } from "./contexts/SignalRConnectionContext";
import "./index.css";

const _cesiumIonToken = process.env.REACT_APP_CESIUM_ION_ACCESS_TOKEN;
if (_cesiumIonToken) {
  Cesium.Ion.defaultAccessToken = _cesiumIonToken;
}

(window as any).CESIUM_BASE_URL = "/cesium/";

(window as any).Cesium = Cesium;

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);

const isRenderPage =
  typeof window !== "undefined" &&
  (window.location.pathname.toLowerCase() === "/render" ||
    /^\/render\/alert\/[^/]+/.test(window.location.pathname));

root.render(
  <React.StrictMode>
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      {isRenderPage ? <MapRenderPage /> : (
        <SignalRConnectionProvider>
          <Main />
        </SignalRConnectionProvider>
      )}
    </ThemeProvider>
  </React.StrictMode>,
);
