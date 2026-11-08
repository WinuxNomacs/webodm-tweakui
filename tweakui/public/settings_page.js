// The TweakUI settings page (templates/settings.html): the navigation pane shows one category at a time (from the
// address's #hash, General by default), and each setting is saved as soon as it is changed: a checkbox as true or
// false, a radio button (Themes) as its value. A new theme, or the theme menu, the Storage or the Performance view
// turned on or off, reloads the page to show it (the header, the side menu). A save shows a green "Saved" banner at
// the top of the category for 3 seconds (after the reload too); a refused one, a red banner saying why, until the next change.
// Settings in a data-depends box are greyed out and disabled while the setting it names is off. A setting with a
// data-preview gets a thumbnail of its screenshot (public/previews/<name>.webp), which a click shows full size in an
// overlay (Esc, a click or its x closes it); a screenshot that doesn't load hides its thumbnail. UMD, so Jest can load it.
(function (root, factory) {
    var node = typeof module === "object" && module.exports;
    var api = factory(node ? require("./core") : root.TweakUI);
    if (node) module.exports = api;
    else if (root.document) root.TweakUI.feature(root, "settings_page", api.start);
})(typeof window !== "undefined" ? window : this, function (ui) {
    "use strict";

    function each(list, fn) { Array.prototype.forEach.call(list, fn); }

    // Shows the category named by the hash, or the first one when it names none
    function showSection(page, hash) {
        var name = (hash || "").replace(/^#/, "");
        if (!page.querySelector("section[data-section='" + name + "']")) {
            name = page.querySelector("section[data-section]").getAttribute("data-section");
        }
        each(page.querySelectorAll("section[data-section]"), function (s) {
            s.hidden = s.getAttribute("data-section") !== name;
        });
        each(page.querySelectorAll(".tweakui-nav a[data-section]"), function (a) {
            var active = a.getAttribute("data-section") === name;
            a.className = a.className.replace(/\s*\b(active|theme-background-highlight)\b(?!-)/g, "");
            if (active) a.className += " active theme-background-highlight";
            if (active) a.setAttribute("aria-selected", "true");
            else a.removeAttribute("aria-selected");
        });
        return name;
    }

    // Greys out and disables the settings of each data-depends box whose setting is off
    function applyDepends(page) {
        each(page.querySelectorAll("[data-depends]"), function (box) {
            var parent = page.querySelector("input[data-setting='" + box.getAttribute("data-depends") + "']");
            var off = !!parent && !parent.checked;
            box.className = box.className.replace(/\s*\btweakui-off\b/, "") + (off ? " tweakui-off" : "");
            each(box.querySelectorAll("input"), function (input) { input.disabled = off; });
        });
    }

    // How long the "Saved" banner stays, and the flag that shows it again after a save reloads the page
    var SHOWN = 3000, RELOADED = "tweakuiSaved";

    // The banner: "Saved" for 3 seconds, a failure until the next change, nothing for an empty text
    function setStatus(page, text, failed) {
        var status = page.querySelector(".tweakui-status");
        if (!status) return;
        clearTimeout(status.tweakuiTimer);
        if (!text) {
            status.className = "tweakui-status theme-border";
            return;
        }
        var doc = status.ownerDocument, icon = doc.createElement("i"), label = doc.createElement("span");
        icon.className = "fa " + (failed ? "fa-exclamation-circle" : "fa-check-circle");
        icon.setAttribute("aria-hidden", "true");
        label.textContent = text;
        status.textContent = "";
        status.appendChild(icon);
        status.appendChild(label);
        status.className = "tweakui-status theme-border tweakui-shown " +
            (failed ? "theme-background-failed" : "theme-background-success");
        if (!failed) status.tweakuiTimer = setTimeout(function () { setStatus(page, "", false); }, SHOWN);
    }

    function storage(win) {
        try {
            return win.sessionStorage || null;
        } catch (e) {
            return null;
        }
    }

    // PATCHes one setting; a failure puts the control back as it was and says why
    function save(page, input, fetchFn, doc, win, previous) {
        var name = input.getAttribute("data-setting"), radio = input.type === "radio", changes = {};
        var value = radio ? input.value : input.checked;
        changes[name] = value;
        setStatus(page, "", false);
        return fetchFn(page.getAttribute("data-api") + "settings", {
            method: "PATCH",
            credentials: "same-origin",
            headers: {"Content-Type": "application/json", "X-CSRFToken": ui.csrfToken(doc)},
            body: JSON.stringify(changes)
        }).then(function (res) {
            return res.json().then(null, function () { return {}; }).then(function (body) {
                if (!res.ok) throw new Error(body.detail || ("Error " + res.status));
                if (win.TweakUI) win.TweakUI.settings = body;
                // The page's scripts that follow a change at once (Surprise Me, the navigation pane)
                if (typeof win.CustomEvent === "function") doc.dispatchEvent(new win.CustomEvent("tweakuiSettingsChanged", {detail: body}));
                setStatus(page, "Saved", false);
                if (name === "theme" || name === "show_theme_menu" || name === "storage_view" || name === "performance_view") {
                    var store = storage(win);
                    try {
                        if (store) store.setItem(RELOADED, "1");
                    } catch (e) { /* no banner after the reload */ }
                    win.location.reload();
                }
            });
        }).then(null, function (e) {
            if (!radio) input.checked = !value;
            else if (previous) previous.checked = true;
            applyDepends(page);
            setStatus(page, "Not saved: " + e.message, true);
        });
    }

    // The overlay showing a screenshot full size; closing it gives the focus back to the thumbnail
    function enlarge(doc, button) {
        var overlay = doc.createElement("div"), backdrop = doc.createElement("div"), figure = doc.createElement("figure");
        var img = doc.createElement("img"), close = doc.createElement("button"), caption = doc.createElement("figcaption");
        overlay.className = "tweakui-preview-overlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-label", button.getAttribute("title"));
        backdrop.className = "modal-backdrop in";
        figure.className = "theme-secondary theme-border";
        img.src = button.querySelector("img").getAttribute("src");
        img.alt = button.querySelector("img").alt;
        caption.textContent = button.getAttribute("title");
        close.type = "button";
        close.className = "close";
        close.setAttribute("aria-label", "Close");
        close.innerHTML = "&times;";
        figure.appendChild(close);
        figure.appendChild(img);
        figure.appendChild(caption);
        overlay.appendChild(backdrop);
        overlay.appendChild(figure);
        function onKey(e) { if (e.key === "Escape" || e.keyCode === 27) shut(); }
        function shut() {
            doc.removeEventListener("keydown", onKey);
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            button.focus();
        }
        overlay.addEventListener("click", shut);
        doc.addEventListener("keydown", onKey);
        doc.body.appendChild(overlay);
        close.focus();
        return overlay;
    }

    // A thumbnail beside each setting with a data-preview, titled with the setting's name
    function addPreviews(page, doc) {
        var base = page.getAttribute("data-previews");
        if (!base) return;
        each(page.querySelectorAll("[data-preview]"), function (box) {
            if (box.querySelector(".tweakui-preview")) return;
            var label = box.querySelector("label");
            var name = label ? label.textContent.replace(/\s+/g, " ").trim()
                : (box.closest("section") && box.closest("section").querySelector("h4").textContent.trim());
            var button = doc.createElement("button"), img = doc.createElement("img");
            button.type = "button";
            button.className = "tweakui-preview theme-border";
            button.setAttribute("title", name);
            img.src = base + box.getAttribute("data-preview") + ".webp";
            img.alt = name;
            img.setAttribute("loading", "lazy");
            img.addEventListener("error", function () {
                button.hidden = true;
                box.className = box.className.replace(/\s*\btweakui-has-preview\b/, "");
            });
            button.appendChild(img);
            button.addEventListener("click", function () { enlarge(doc, button); });
            box.appendChild(button);
            box.className += " tweakui-has-preview";
        });
    }

    // Themes > Sample does nothing: Enter in its text field doesn't submit, and its links don't change the page's hash
    // (which picks the category). Its dropdown and tooltip are Bootstrap's, when the page has them.
    function inertSample(page, win) {
        each(page.querySelectorAll(".tweakui-sample"), function (form) {
            form.addEventListener("submit", function (e) { e.preventDefault(); });
            form.addEventListener("click", function (e) {
                var link = e.target.closest ? e.target.closest("a") : null;
                if (link && form.contains(link)) e.preventDefault();
            });
            // Bootstrap's tooltip comes with WebODM's bundle, which loads after this script: set up on the first hover
            function tooltip(e) {
                var target = e.target.closest ? e.target.closest("[data-toggle=tooltip]") : null, $ = win.jQuery;
                if (!target || !$ || !$.fn || !$.fn.tooltip || $(target).data("bs.tooltip")) return;
                $(target).tooltip().tooltip("show");
            }
            form.addEventListener("mouseover", tooltip);
            form.addEventListener("focusin", tooltip);
        });
    }

    function start(doc, win) {
        var page = doc.getElementById("tweakui-settings");
        if (!page) return;
        showSection(page, win.location.hash);
        applyDepends(page);
        addPreviews(page, doc);
        inertSample(page, win);
        // A save that reloaded the page
        var store = storage(win);
        try {
            if (store && store.getItem(RELOADED)) {
                store.removeItem(RELOADED);
                setStatus(page, "Saved", false);
            }
        } catch (e) { /* no banner */ }
        win.addEventListener("hashchange", function () { showSection(page, win.location.hash); });
        // A radio button's group remembers its checked one, to put it back if the change is refused
        var checked = {};
        each(page.querySelectorAll("input[type=radio][data-setting]:checked"), function (input) {
            checked[input.name] = input;
        });
        each(page.querySelectorAll("input[data-setting]"), function (input) {
            input.addEventListener("change", function () {
                var previous = checked[input.name];
                if (input.type === "radio") checked[input.name] = input;
                applyDepends(page);
                save(page, input, win.fetch.bind(win), doc, win, previous).then(function () {
                    if (input.type === "radio" && !input.checked && previous) checked[input.name] = previous;
                });
            });
        });
    }

    return {start: start, showSection: showSection, save: save, applyDepends: applyDepends,
        addPreviews: addPreviews, enlarge: enlarge, inertSample: inertSample, setStatus: setStatus};
});
