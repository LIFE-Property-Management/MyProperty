import nextJest from "next/jest.js";

const createJestConfig = nextJest({
    dir: "./",
});

/** @type {import('jest').Config} */
const config = {
    testEnvironment: "jest-environment-jsdom",
    setupFiles: ["<rootDir>/jest.polyfills.ts"],
    setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    testPathIgnorePatterns: ["/node_modules/", "/.next/", "/e2e/"],
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/$1",
    },
    collectCoverageFrom: [
        "app/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "lib/**/*.{ts,tsx}",
        "!**/*.d.ts",
        "!**/node_modules/**",
        "!**/.next/**",
        "!**/loading.tsx",
        "!**/error.tsx",
        "!**/not-found.tsx",
    ],
    coverageDirectory: "coverage",
    coverageReporters: ["text", "html", "lcov"],
};

const jestConfig = async () => {
    const finalConfig = await createJestConfig(config)();
    return {
        ...finalConfig,
        transformIgnorePatterns: [
            "/node_modules/(?!(keycloak-js)/)",
        ],
    };
};

export default jestConfig;
