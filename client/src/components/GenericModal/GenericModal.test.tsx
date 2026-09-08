import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GenericModal } from "./GenericModal";

describe("GenericModal login mode", () => {
  it("submits credentials to the login handler", async () => {
    const onClose = jest.fn();
    const onLogin = jest.fn().mockResolvedValue(undefined);

    render(
      <GenericModal
        open
        mode="login"
        onClose={onClose}
        onLogin={onLogin}
      />,
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: " user@example.com " },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() =>
      expect(onLogin).toHaveBeenCalledWith("user@example.com", "secret"),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
