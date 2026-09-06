export default {
    bracketSameLine: false,
    bracketSpacing: true,
    endOfLine: "auto",
    overrides: [
        {
            files: ["components.json", "package.json"],
            options: {
                tabWidth: 2,
            },
        },
    ],
    printWidth: 120,
    semi: true,
    singleQuote: false,
    tabWidth: 4,
    trailingComma: "all",
};
