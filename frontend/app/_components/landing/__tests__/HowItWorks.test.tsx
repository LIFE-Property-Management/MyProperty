import { render, screen } from "@testing-library/react";
import HowItWorks from "../HowItWorks";

describe("<HowItWorks />", () => {
    it("renders the section heading", () => {
        render(<HowItWorks />);
        expect(screen.getByText(/get started in minutes/i)).toBeInTheDocument();
    });

    it("renders step numbers 1, 2, and 3", () => {
        render(<HowItWorks />);
        expect(screen.getByText("1")).toBeInTheDocument();
        expect(screen.getByText("2")).toBeInTheDocument();
        expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("renders all three step titles", () => {
        render(<HowItWorks />);
        expect(screen.getByText("Add your property")).toBeInTheDocument();
        expect(screen.getByText("Invite your tenant by email")).toBeInTheDocument();
        expect(screen.getByText("Track rent automatically")).toBeInTheDocument();
    });
});
