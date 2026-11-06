// ESLint for the plugin's front end: `npm run lint` at the repo root, or the VSCode ESLint extension
import js from "@eslint/js";
import globals from "globals";

export default [
    {ignores: ["**/node_modules/", "**/build/", "**/dist/", "ignored/"]},
    {
        // The plugin's scripts: plain ES5, loaded by <script> tags on every WebODM page and by Jest
        files: ["tweakui/public/*.js"],
        ...js.configs.recommended,
        languageOptions: {
            ecmaVersion: 5,
            sourceType: "script",
            // ES5 syntax, but the ES2015 Promise the browsers have; module and require for a UMD wrapper
            globals: {...globals.browser, Promise: "readonly", module: "readonly", require: "readonly", PluginsAPI: "readonly"},
        },
        // ES5 has no catch without a binding, so one left unused is no mistake
        rules: {...js.configs.recommended.rules, "no-unused-vars": ["error", {caughtErrors: "none"}]},
    },
    {
        files: ["tweakui/public/__tests__/**/*.js", "tools/**/*.js"],
        ...js.configs.recommended,
        languageOptions: {ecmaVersion: 2022, sourceType: "commonjs", globals: {...globals.browser, ...globals.node, ...globals.jest}},
    },
];
