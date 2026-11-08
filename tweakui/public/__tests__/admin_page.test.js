const core = require("../core");
const adminPage = require("../admin_page");

function page() {
    document.body.innerHTML = `
      <div id="tweakui-admin" data-api="/api/plugins/tweakui/">
        <input type="hidden" name="csrfmiddlewaretoken" value="tok">
        <p class="tweakui-status theme-border"></p>
        <input type="checkbox" data-access="storage_view" checked>
        <input type="checkbox" data-access="performance_view" checked>
      </div>`;
    return document.getElementById("tweakui-admin");
}

const answer = (body, ok = true, status = 200) => Promise.resolve({ok, status, json: () => Promise.resolve(body)});

beforeAll(() => { core.install(window); });

describe("Administration > TweakUI", () => {
    test("a page without its root is left alone", () => {
        document.body.innerHTML = "";
        expect(adminPage.start(document, window, jest.fn())).toBeNull();
    });

    test("unticking a feature saves it at once with the CSRF token and says Saved", async () => {
        const root = page();
        const fetchFn = jest.fn(() => answer({storage_view: false, performance_view: true}));
        const view = adminPage.start(document, window, fetchFn);
        const box = root.querySelector("[data-access=storage_view]");
        box.checked = false;
        box.dispatchEvent(new Event("change"));
        await view.saves[0];
        const [url, options] = fetchFn.mock.calls[0];
        expect(url).toBe("/api/plugins/tweakui/access");
        expect(options.method).toBe("PATCH");
        expect(options.headers["X-CSRFToken"]).toBe("tok");
        expect(JSON.parse(options.body)).toEqual({storage_view: false});
        expect(root.querySelector(".tweakui-status").textContent).toBe("Saved");
        expect(root.querySelector(".tweakui-status").className).toContain("theme-background-success");
        expect(box.checked).toBe(false);
    });

    test("a refused change goes back and says why", async () => {
        const root = page();
        const view = adminPage.start(document, window, jest.fn(() => answer({detail: "Nope"}, false, 403)));
        const box = root.querySelector("[data-access=performance_view]");
        box.checked = false;
        box.dispatchEvent(new Event("change"));
        await view.saves[0];
        expect(box.checked).toBe(true);
        expect(root.querySelector(".tweakui-status").textContent).toBe("Not saved: Nope");
        expect(root.querySelector(".tweakui-status").className).toContain("theme-background-failed");
    });
});
