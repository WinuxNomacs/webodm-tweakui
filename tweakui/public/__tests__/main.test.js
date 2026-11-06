const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "..", "main.js"), "utf8");

test("loading the script marks the page with the tweakui class and keeps its other classes", () => {
    document.documentElement.className = "theme";
    new Function(source)();
    expect(document.documentElement.classList.contains("tweakui")).toBe(true);
    expect(document.documentElement.classList.contains("theme")).toBe(true);
});
