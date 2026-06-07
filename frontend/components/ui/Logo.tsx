import type { ReactNode } from "react";

export interface LogoProps {
    size?: number;
}

export function Logo({ size = 22 }: LogoProps): ReactNode {
    const boxSize = size + 8;
    const svgSize = size - 4;

    return (
        <div className="flex items-center gap-2.5">
            <div
                className="bg-primary rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ width: boxSize, height: boxSize }}
            >
                <svg
                    width={svgSize}
                    height={svgSize}
                    viewBox="0 0 18 18"
                    fill="none"
                    aria-hidden="true"
                >
                    <path d="M9 2L2 7v9h5v-5h4v5h5V7L9 2z" fill="#fff" fillOpacity={0.9} />
                </svg>
            </div>
            <span className="font-heading text-primary-text font-semibold tracking-tight" style={{ fontSize: size }}>
                MyProperty
            </span>
        </div>
    );
}

export default Logo;
