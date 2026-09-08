import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import {
  OrefAlertUiProvider,
  useOrefAlertUi,
  type OrefAlertUiValue,
} from "../../contexts/OrefAlertUiContext";
import { appTheme } from "../../theme";
import { AlertFeed } from "./AlertFeed";

jest.mock("../../contexts/OrefAlertUiContext", () => {
  const actual = jest.requireActual("../../contexts/OrefAlertUiContext");
  return { ...actual, useOrefAlertUi: jest.fn() };
});

let mobileViewport = false;
const mockedUseOrefAlertUi = useOrefAlertUi as jest.MockedFunction<
  typeof useOrefAlertUi
>;

const baseUiValue: OrefAlertUiValue = {
  connected: false,
  alerts: [],
  blinking: {},
  soundEnabled: true,
  ready: false,
  testAlert: jest.fn(),
  clearAlerts: jest.fn(),
  enableSound: jest.fn(),
  disableSound: jest.fn(),
  unlockSound: jest.fn(),
  publish: jest.fn(),
};

function setMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation(() => ({
      matches: mobileViewport,
      media: "",
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

function renderFeed() {
  return render(
    <ThemeProvider theme={appTheme}>
      <OrefAlertUiProvider>
        <AlertFeed />
      </OrefAlertUiProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  mobileViewport = false;
  setMatchMedia();
  mockedUseOrefAlertUi.mockReturnValue(baseUiValue);
});

it("renders as a permanent sidebar on desktop", () => {
  renderFeed();

  expect(
    screen.queryByRole("button", { name: /expand alert feed/i }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /test alert/i })).toBeVisible();
});

it("renders collapsed controls that can expand on mobile", () => {
  mobileViewport = true;
  renderFeed();

  const expand = screen.getByRole("button", { name: /expand alert feed/i });
  expect(expand).toHaveAttribute("aria-expanded", "false");
  expect(
    screen.queryByRole("button", { name: /test alert/i }),
  ).not.toBeInTheDocument();

  fireEvent.click(expand);

  expect(
    screen.getByRole("button", { name: /collapse alert feed/i }),
  ).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("button", { name: /test alert/i })).toBeVisible();
});

it("shows active alerts and invokes available controls", () => {
  const testAlert = jest.fn();
  const clearAlerts = jest.fn();
  const enableSound = jest.fn();
  mockedUseOrefAlertUi.mockReturnValue({
    ...baseUiValue,
    connected: true,
    ready: true,
    soundEnabled: false,
    testAlert,
    clearAlerts,
    enableSound,
    alerts: [
      {
        id: "alert-1",
        cat: "1",
        title: "Rocket alert",
        desc: "Take shelter",
        data: ["Haifa", "Acre"],
        time: new Date("2026-09-08T00:00:00Z"),
      },
    ],
    blinking: { "alert-1": true },
  });

  renderFeed();

  fireEvent.click(screen.getByRole("button", { name: /test alert/i }));
  fireEvent.click(screen.getByRole("button", { name: /clear/i }));
  fireEvent.click(screen.getByRole("button", { name: /enable sound/i }));

  expect(testAlert).toHaveBeenCalledTimes(1);
  expect(clearAlerts).toHaveBeenCalledTimes(1);
  expect(enableSound).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Rocket alert")).toBeVisible();
  expect(screen.getByText("Take shelter")).toBeVisible();
  expect(screen.getByText(/Haifa, Acre/)).toBeVisible();
  expect(screen.getByLabelText("connected")).toBeVisible();
});

it("disables sound and explains a disconnected ready feed", () => {
  const disableSound = jest.fn();
  mockedUseOrefAlertUi.mockReturnValue({
    ...baseUiValue,
    ready: true,
    disableSound,
  });

  renderFeed();

  fireEvent.click(screen.getByRole("button", { name: /disable sound/i }));

  expect(disableSound).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/link down/i)).toBeVisible();
});
