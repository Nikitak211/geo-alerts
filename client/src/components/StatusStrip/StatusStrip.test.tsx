import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { appTheme } from "../../theme";
import { StatusStrip } from "./StatusStrip";

describe("StatusStrip mobile authentication", () => {
  it("opens the login dialog from the compact login control", () => {
    const onOpenLogin = jest.fn();

    render(
      <ThemeProvider theme={appTheme}>
        <StatusStrip
          user={null}
          paymentMethods={[]}
          selectedPaymentMethodId={null}
          onSelectPaymentMethod={jest.fn()}
          onLogin={jest.fn().mockResolvedValue(undefined)}
          onRegister={jest.fn().mockResolvedValue(undefined)}
          onLogout={jest.fn().mockResolvedValue(undefined)}
          onOpenLogin={onOpenLogin}
          onOpenRegister={jest.fn()}
          onOpenAddPaymentMethod={jest.fn()}
          onOpenBets={jest.fn()}
          onOpenPlaceBet={jest.fn()}
          onLoadBalance={jest.fn().mockResolvedValue(undefined)}
        />
      </ThemeProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Open login dialog" }),
    );

    expect(onOpenLogin).toHaveBeenCalledTimes(1);
  });
});
