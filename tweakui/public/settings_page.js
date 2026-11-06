// The TweakUI settings page (templates/settings.html): the navigation pane shows one category at a time (from the
// address's #hash, General by default), and each setting is saved as soon as it is changed: a checkbox as true or
// false, a radio button (Themes) as its value. A new theme, or the theme menu or the Storage view turned on or off,
// reloads the page to show it (the header, the side menu).
// Settings in a data-depends box are greyed out and disabled while the setting it names is off. A setting with a
// data-preview gets a thumbnail of its screenshot (public/previews/<name>.webp), which a click shows full size in an
// overlay (Esc, a click or its x closes it); a screenshot that doesn't load hides its thumbnail. UMD, so Jest can load it.
(function (root, factory) {
    var api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else if (root.document) api.start(root.document, root);
})(typeof window !== "undefined" ? window : this, function () {
    "use strict";

    function csrfToken(doc) {
        var input = doc.querySelector("input[name=csrfmiddlewaretoken]");
        if (input && input.value) return input.value;
        var m = (doc.cookie || "").match(/(?:^|;\s*)csrftoken=([^;]+)/);
        return m ? decodeURIComponent(m[1]) : "";
    }

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

    function setStatus(page, text, failed) {
        var status = page.querySelector(".tweakui-status");
        status.textContent = text;
        status.className = "tweakui-status" + (failed ? " text-danger" : " text-muted");
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
            headers: {"Content-Type": "application/json", "X-CSRFToken": csrfToken(doc)},
            body: JSON.stringify(changes)
        }).then(function (res) {
            return res.json().then(null, function () { return {}; }).then(function (body) {
                if (!res.ok) throw new Error(body.detail || ("Error " + res.status));
                if (win.TweakUI) win.TweakUI.settings = body;
                setStatus(page, "Saved", false);
                if (name === "theme" || name === "show_theme_menu" || name === "storage_view") win.location.reload();
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

    return {start: start, showSection: showSection, save: save, csrfToken: csrfToken, applyDepends: applyDepends,
        addPreviews: addPreviews, enlarge: enlarge, inertSample: inertSample};
});
