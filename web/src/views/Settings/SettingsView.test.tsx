import { render, screen } from "@testing-library/react";

import SettingsView from "@views/Settings/SettingsView";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@hooks/State", () => ({
    useAutheliaState: () => [
        { authentication_level: 2, default_redirection_url: "https://example.com", username: "john" },
        vi.fn(),
        false,
        null,
    ],
}));

it("renders the settings overview", () => {
    render(<SettingsView />);
    expect(screen.getByText("Sitzungsdetails")).toBeInTheDocument();
    expect(screen.getByText("john")).toBeInTheDocument();
});
