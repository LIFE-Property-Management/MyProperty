import { render, screen } from "@testing-library/react";
import FeaturesGrid from "../FeaturesGrid";

describe("<FeaturesGrid />", () => {
    it("renders the section heading", () => {
        render(<FeaturesGrid />);
        expect(screen.getByText(/everything you need to manage/i)).toBeInTheDocument();
    });

    it("renders the Lease management feature", () => {
        render(<FeaturesGrid />);
        expect(screen.getByText("Lease management")).toBeInTheDocument();
    });

    it("renders the Automated rent collection feature", () => {
        render(<FeaturesGrid />);
        expect(screen.getByText("Automated rent collection")).toBeInTheDocument();
    });

    it("renders the Tenant portal feature", () => {
        render(<FeaturesGrid />);
        expect(screen.getByText("Tenant portal")).toBeInTheDocument();
    });
});
