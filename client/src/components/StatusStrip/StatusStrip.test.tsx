import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { appTheme } from "../../theme";
import { StatusStrip } from "./StatusStrip";

describe("StatusStrip", () => {
  it("shows link status and has no account controls", () => {
    render(
      <ThemeProvider theme={appTheme}>
        <StatusStrip connected alertCount={3} lastPollAt={null} />
      </ThemeProvider>,
    );
    expect(screen.getByText(/LINK UP/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /login|register|wallet/i })).toBeNull();
  });
});
