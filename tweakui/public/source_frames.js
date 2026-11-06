// 2D Map and 3D Map > Source Frames: a button beside Share, in the map's action buttons, picks
// a spot or draws an area on the 2D map or the 3D model, and opens a window of the task's photos that show it, best
// first (a spot's by how near it is to the frame's centre, an area's by the share of the area shown): each photo
// with the place drawn on it, its properties, a full-screen viewer and a download. The photos are found by TweakUI's
// API (frames.py: the photos' poses and lenses, the ground's height). A project's map searches each of its tasks
// with cameras. Leaflet, Potree and three.js are the page's globals; the 3D pick is pick3d.js's. UMD, so Jest can
// load it.
(function (root, factory) {
    if (typeof module === "object" && module.exports) module.exports = factory(require("./pick3d"));
    else if (root.document) factory(root.TweakUI && root.TweakUI.pick3d).start(root.document, root);
})(typeof window !== "undefined" ? window : this, function (pick3d) {
    "use strict";

    var THUMB = 160, PHOTO = 1024;
    // How far a press may move and still be a click (the 3D view orbits on a drag)
    var CLICK_SLOP = 5;
    // An area is finished by a click this near its first corner (in pixels)
    var CLOSE_PX = 12;

    // Helpers

    function el(doc, tag, className, text) {
        var e = doc.createElement(tag);
        if (className) e.className = className;
        if (text !== undefined) e.textContent = text;
        return e;
    }

    function icon(doc, name) { return el(doc, "i", "fa " + name); }

    function csrfToken(doc) {
        var m = (doc.cookie || "").match(/(?:^|;\s*)csrftoken=([^;]+)/);
        return m ? decodeURIComponent(m[1]) : "";
    }

    function imageUrl(frame, kind, size) {
        var url = "/api/projects/" + frame.task.project + "/tasks/" + frame.task.id + "/images/" + kind + "/" +
            encodeURIComponent(frame.filename);
        return size ? url + "?size=" + size : url;
    }

    // A button, not a link: WebODM's link colour would win over the button's. WebODM sends the photo as an
    // attachment, so the page stays
    function downloadButton(doc, win, className, text) {
        var b = el(doc, "button", "btn btn-sm btn-secondary" + (className ? " " + className : ""));
        b.type = "button";
        b.title = "Download";
        b.setAttribute("aria-label", "Download");
        b.appendChild(icon(doc, "fa-download"));
        if (text) b.appendChild(doc.createTextNode(" " + text));
        b.addEventListener("click", function (e) {
            e.stopPropagation();
            win.location.assign(b.getAttribute("data-href"));
        });
        return b;
    }

    function percent(share) { return Math.round(share * 100) + "%"; }

    function formatTime(seconds) {
        if (!seconds) return "";
        var d = new Date(seconds * 1000);
        return isNaN(d.getTime()) ? "" : d.toLocaleString();
    }

    // The tasks of a map's tiles that have cameras, once each
    function tasksWithCameras(tiles) {
        var seen = {}, tasks = [];
        (tiles || []).forEach(function (t) {
            var task = t && t.meta && t.meta.task;
            if (!task || !task.camera_shots || seen[task.id]) return;
            seen[task.id] = true;
            tasks.push(task);
        });
        return tasks;
    }

    // The photos of several tasks in one list, best first (as frames.py orders one task's)
    function merge(results, area) {
        var all = [];
        results.forEach(function (r) {
            (r.frames || []).forEach(function (f) { f.task = r.task; all.push(f); });
        });
        all.sort(function (a, b) {
            if (area && a.share !== b.share) return b.share - a.share;
            return a.centre - b.centre;
        });
        return all;
    }

    // Asks TweakUI's API for the photos of each task that show a place; resolves to {frames, errors}
    function findFrames(fetchFn, doc, tasks, place) {
        return Promise.all(tasks.map(function (task) {
            return fetchFn("/api/plugins/tweakui/frames/" + task.project + "/" + task.id, {
                method: "POST", credentials: "same-origin",
                headers: {"Content-Type": "application/json", "X-CSRFToken": csrfToken(doc)},
                body: JSON.stringify(place)
            }).then(function (res) {
                return res.json().then(function (body) {
                    if (!res.ok) throw new Error((body && body.detail) || ("Error " + res.status));
                    return {task: task, frames: body.frames};
                }, function () { throw new Error("Error " + res.status); });
            }).then(null, function (e) { return {task: task, error: e.message}; });
        })).then(function (results) {
            return {
                frames: merge(results.filter(function (r) { return !r.error; }), place.type === "Polygon"),
                errors: results.filter(function (r) { return r.error; }).map(function (r) {
                    return (tasks.length > 1 ? (r.task.name || "Task #" + r.task.id) + ": " : "") + r.error;
                })
            };
        });
    }

    // The place drawn on a photo: an SVG over it, in fractions of its width and height
    var SVGNS = "http://www.w3.org/2000/svg";
    function overlay(doc, frame) {
        var svg = doc.createElementNS(SVGNS, "svg");
        svg.setAttribute("class", "tweakui-sf-overlay");
        svg.setAttribute("viewBox", "0 0 1 1");
        svg.setAttribute("preserveAspectRatio", "none");
        if (frame.spot) {
            [["tweakui-sf-ring-outer", 0.035], ["tweakui-sf-ring", 0.035]].forEach(function (r) {
                var ring = doc.createElementNS(SVGNS, "ellipse");
                ring.setAttribute("class", r[0]);
                ring.setAttribute("cx", frame.spot[0]);
                ring.setAttribute("cy", frame.spot[1]);
                // Round on the photo: the radius in each direction is a share of the other side
                var aspect = (frame.width && frame.height) ? frame.width / frame.height : 1;
                ring.setAttribute("rx", r[1] / Math.max(aspect, 1));
                ring.setAttribute("ry", r[1] * Math.min(aspect, 1));
                ring.setAttribute("vector-effect", "non-scaling-stroke");
                svg.appendChild(ring);
            });
        } else if (frame.outline) {
            var points = frame.outline.map(function (p) { return p[0] + "," + p[1]; }).join(" ");
            ["tweakui-sf-outline-outer", "tweakui-sf-outline"].forEach(function (c) {
                var poly = doc.createElementNS(SVGNS, "polygon");
                poly.setAttribute("class", c);
                poly.setAttribute("points", points);
                poly.setAttribute("vector-effect", "non-scaling-stroke");
                svg.appendChild(poly);
            });
        }
        return svg;
    }

    function photo(doc, frame, size, className) {
        var wrap = el(doc, "div", "tweakui-sf-photo" + (className ? " " + className : ""));
        var img = el(doc, "img");
        img.alt = frame.filename;
        img.draggable = false;
        img.src = imageUrl(frame, "thumbnail", size);
        wrap.appendChild(img);
        wrap.appendChild(overlay(doc, frame));
        return wrap;
    }

    // Lets a box be dragged by its handle, within its container
    function draggable(doc, box, handle, container) {
        var start = null;
        handle.addEventListener("pointerdown", function (e) {
            if (e.target.closest && e.target.closest("button, a")) return;
            var b = box.getBoundingClientRect(), c = container.getBoundingClientRect();
            start = {x: e.clientX, y: e.clientY, left: b.left - c.left, top: b.top - c.top, b: b, c: c};
            if (handle.setPointerCapture && e.pointerId !== undefined) {
                try { handle.setPointerCapture(e.pointerId); } catch (err) { /* a synthetic event */ }
            }
            e.preventDefault();
            e.stopPropagation();
        });
        handle.addEventListener("pointermove", function (e) {
            if (!start) return;
            var left = Math.max(0, Math.min(start.left + e.clientX - start.x, start.c.width - start.b.width));
            var top = Math.max(0, Math.min(start.top + e.clientY - start.y, start.c.height - start.b.height));
            box.style.left = left + "px";
            box.style.top = top + "px";
            box.style.right = "auto";
            box.style.bottom = "auto";
        });
        function end() { start = null; }
        handle.addEventListener("pointerup", end);
        handle.addEventListener("pointercancel", end);
    }

    // The full-screen viewer of a photo, with zoom (wheel, pinch, buttons) and pan (drag), and the previous and
    // next photos (arrow keys). Returns {element, close}
    function viewer(doc, win, frames, index, onClose) {
        var root = el(doc, "div", "tweakui-sf-viewer theme-secondary theme-color-primary");
        root.setAttribute("role", "dialog");
        root.setAttribute("aria-label", "Full frame");
        var bar = el(doc, "div", "tweakui-sf-viewer-bar theme-border");
        var name = el(doc, "span", "tweakui-sf-viewer-name");
        var stage = el(doc, "div", "tweakui-sf-viewer-stage");
        var view = {scale: 1, x: 0, y: 0}, current = null, keys;

        function button(iconName, title, action) {
            var b = el(doc, "button", "btn btn-sm btn-secondary");
            b.type = "button";
            b.title = title;
            b.setAttribute("aria-label", title);
            b.appendChild(icon(doc, iconName));
            b.addEventListener("click", function (e) { e.stopPropagation(); action(); });
            return b;
        }

        function apply() {
            if (current) current.style.transform = "translate(" + view.x + "px, " + view.y + "px) scale(" + view.scale + ")";
        }

        function zoom(factor, cx, cy) {
            var s = Math.max(1, Math.min(view.scale * factor, 20));
            var r = stage.getBoundingClientRect();
            // Around the given point (the stage's centre otherwise)
            var px = (cx === undefined ? r.width / 2 : cx - r.left) - r.width / 2;
            var py = (cy === undefined ? r.height / 2 : cy - r.top) - r.height / 2;
            view.x = px - (px - view.x) * s / view.scale;
            view.y = py - (py - view.y) * s / view.scale;
            view.scale = s;
            if (s === 1) view.x = view.y = 0;
            apply();
        }

        function show(i) {
            index = (i + frames.length) % frames.length;
            var frame = frames[index];
            view = {scale: 1, x: 0, y: 0};
            stage.textContent = "";
            current = photo(doc, frame, 99999999, "tweakui-sf-viewer-photo");
            stage.appendChild(current);
            name.textContent = (index + 1) + " / " + frames.length + " · " + frame.filename;
            name.title = frame.filename;
            download.setAttribute("data-href", imageUrl(frame, "download"));
            apply();
        }

        var download = downloadButton(doc, win);
        bar.appendChild(button("fa-chevron-left", "Previous photo", function () { show(index - 1); }));
        bar.appendChild(name);
        bar.appendChild(button("fa-chevron-right", "Next photo", function () { show(index + 1); }));
        bar.appendChild(button("fa-search-minus", "Zoom out", function () { zoom(1 / 1.5); }));
        bar.appendChild(button("fa-search-plus", "Zoom in", function () { zoom(1.5); }));
        bar.appendChild(download);
        bar.appendChild(button("fa-times", "Close", close));
        root.appendChild(bar);
        root.appendChild(stage);

        stage.addEventListener("wheel", function (e) {
            e.preventDefault();
            zoom(e.deltaY < 0 ? 1.25 : 0.8, e.clientX, e.clientY);
        });
        var pointers = {}, pan = null, pinch = null;
        stage.addEventListener("pointerdown", function (e) {
            pointers[e.pointerId] = {x: e.clientX, y: e.clientY};
            var ids = Object.keys(pointers);
            if (ids.length === 1) pan = {x: e.clientX - view.x, y: e.clientY - view.y};
            else if (ids.length === 2) {
                var a = pointers[ids[0]], b = pointers[ids[1]];
                pinch = {d: Math.hypot(a.x - b.x, a.y - b.y), scale: view.scale};
                pan = null;
            }
            e.preventDefault();
        });
        stage.addEventListener("pointermove", function (e) {
            if (!pointers[e.pointerId]) return;
            pointers[e.pointerId] = {x: e.clientX, y: e.clientY};
            var ids = Object.keys(pointers);
            if (pinch && ids.length === 2) {
                var a = pointers[ids[0]], b = pointers[ids[1]];
                var d = Math.hypot(a.x - b.x, a.y - b.y);
                if (pinch.d > 0) zoom(pinch.scale * d / pinch.d / view.scale, (a.x + b.x) / 2, (a.y + b.y) / 2);
            } else if (pan && view.scale > 1) {
                view.x = e.clientX - pan.x;
                view.y = e.clientY - pan.y;
                apply();
            }
        });
        function lift(e) {
            delete pointers[e.pointerId];
            if (Object.keys(pointers).length < 2) pinch = null;
            if (!Object.keys(pointers).length) pan = null;
        }
        stage.addEventListener("pointerup", lift);
        stage.addEventListener("pointercancel", lift);
        stage.addEventListener("dblclick", function (e) {
            if (view.scale > 1) zoom(1 / view.scale); else zoom(3, e.clientX, e.clientY);
        });

        keys = function (e) {
            if (e.key === "Escape") { e.stopPropagation(); close(); }
            else if (e.key === "ArrowLeft") show(index - 1);
            else if (e.key === "ArrowRight") show(index + 1);
            else if (e.key === "+" || e.key === "=") zoom(1.5);
            else if (e.key === "-") zoom(1 / 1.5);
        };
        doc.addEventListener("keydown", keys, true);

        function close() {
            doc.removeEventListener("keydown", keys, true);
            if (root.parentNode) root.parentNode.removeChild(root);
            if (onClose) onClose(index);
        }

        show(index);
        doc.body.appendChild(root);
        return {element: root, close: close, show: show};
    }

    // The window of the photos: the list, best first, and the chosen one with its properties. Returns {element,
    // close, select}
    function buildWindow(doc, win, container, state, onClose) {
        var box = el(doc, "div", "tweakui-sf-window theme-secondary theme-color-primary theme-border");
        box.setAttribute("role", "dialog");
        box.setAttribute("aria-label", "Source Frames");
        var head = el(doc, "div", "tweakui-sf-head theme-background-highlight");
        var title = el(doc, "span", "tweakui-sf-title", "Source Frames");
        var closeButton = el(doc, "button", "close tweakui-sf-close");
        closeButton.type = "button";
        closeButton.title = "Close";
        closeButton.setAttribute("aria-label", "Close");
        closeButton.innerHTML = "&times;";
        head.appendChild(title);
        head.appendChild(closeButton);
        var body = el(doc, "div", "tweakui-sf-body");
        box.appendChild(head);
        box.appendChild(body);
        container.appendChild(box);
        draggable(doc, box, head, container);
        // Clicks and wheel in the window stay out of the map
        ["click", "dblclick", "mousedown", "pointerdown", "touchstart", "wheel", "contextmenu"].forEach(function (t) {
            box.addEventListener(t, function (e) { e.stopPropagation(); });
        });

        var selected = 0, list, main, full = null, frames = [];

        function details(frame) {
            var table = el(doc, "table", "table table-condensed tweakui-sf-props");
            var rows = [["File", frame.filename]];
            if (state.multiple) rows.push(["Task", frame.task.name || "Task #" + frame.task.id]);
            if (state.area) rows.push(["Area shown", percent(frame.share)]);
            rows.push(["Captured", formatTime(frame.capture_time)]);
            rows.push(["Camera", frame.camera ? frame.camera.replace(/^v2 /, "") : ""]);
            rows.push(["Size", frame.width && frame.height ? frame.width + " × " + frame.height + " px" : ""]);
            rows.push(["Camera altitude", typeof frame.altitude === "number" ? frame.altitude.toFixed(1) + " m" : ""]);
            var tbody = el(doc, "tbody");
            rows.forEach(function (r) {
                if (!r[1]) return;
                var tr = el(doc, "tr");
                tr.appendChild(el(doc, "th", "", r[0]));
                var td = el(doc, "td", "", r[1]);
                td.title = r[1];
                tr.appendChild(td);
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            return table;
        }

        function select(i) {
            selected = i;
            var frame = frames[i];
            Array.prototype.forEach.call(list.children, function (item, j) {
                item.classList.toggle("active", j === i);
                item.setAttribute("aria-selected", j === i ? "true" : "false");
            });
            main.textContent = "";
            var big = photo(doc, frame, PHOTO, "tweakui-sf-main-photo");
            big.title = "Open full frame";
            big.addEventListener("click", function () { openFull(); });
            main.appendChild(big);
            var actions = el(doc, "div", "tweakui-sf-actions");
            var open = el(doc, "button", "btn btn-sm btn-primary tweakui-sf-open");
            open.type = "button";
            open.appendChild(icon(doc, "fa-expand"));
            open.appendChild(doc.createTextNode(" Open full frame"));
            open.addEventListener("click", openFull);
            var download = downloadButton(doc, win, "tweakui-sf-download", "Download");
            download.setAttribute("data-href", imageUrl(frame, "download"));
            actions.appendChild(open);
            actions.appendChild(download);
            main.appendChild(actions);
            main.appendChild(details(frame));
        }

        function openFull() {
            if (full) return;
            full = viewer(doc, win, frames, selected, function (i) {
                full = null;
                if (i !== selected && box.parentNode) {
                    select(i);
                    if (list.children[i] && list.children[i].scrollIntoView) list.children[i].scrollIntoView({block: "nearest"});
                }
            });
        }

        function message(text, className) {
            body.textContent = "";
            body.appendChild(el(doc, "p", "tweakui-sf-message" + (className ? " " + className : ""), text));
        }

        function show(result) {
            frames = result.frames;
            title.textContent = "Source Frames (" + frames.length + ")";
            body.textContent = "";
            if (result.errors.length) {
                var err = el(doc, "p", "tweakui-sf-message text-danger");
                err.textContent = result.errors.join("; ");
                body.appendChild(err);
            }
            if (!frames.length) {
                if (!result.errors.length) message(state.area ? "No photo shows this area." : "No photo shows this spot.", "text-muted");
                return;
            }
            list = el(doc, "div", "tweakui-sf-list theme-border");
            list.setAttribute("role", "listbox");
            list.setAttribute("aria-label", "Photos, best first");
            frames.forEach(function (frame, i) {
                var item = el(doc, "button", "tweakui-sf-item theme-border theme-secondary");
                item.type = "button";
                item.setAttribute("role", "option");
                item.title = frame.filename + (state.area ? " (" + percent(frame.share) + " of the area)" : "");
                var thumb = photo(doc, frame, THUMB);
                thumb.querySelector("img").loading = "lazy";
                item.appendChild(thumb);
                item.appendChild(el(doc, "span", "tweakui-sf-caption",
                    state.area ? percent(frame.share) : "#" + (i + 1)));
                item.addEventListener("click", function () { select(i); });
                list.appendChild(item);
            });
            main = el(doc, "div", "tweakui-sf-main");
            body.appendChild(list);
            body.appendChild(main);
            select(0);
        }

        // `replaced`: by the window of a new place
        function close(replaced) {
            if (full) full.close();
            if (box.parentNode) box.parentNode.removeChild(box);
            if (onClose) onClose(replaced === true);
        }
        closeButton.addEventListener("click", function () { close(); });

        message("Finding the photos…");
        return {element: box, close: close, show: show, select: function (i) { select(i); }, frames: function () { return frames; }};
    }

    // The tool bar: Spot or Area, and while an area is drawn, Finish and Cancel. `tool` is the map's or the 3D
    // view's: {start(kind, done), cancel(), finish(), clear()}. Returns {element, close}
    function buildBar(doc, win, container, tool, onPlace, onClose) {
        var bar = el(doc, "div", "tweakui-sf-bar theme-secondary theme-color-primary theme-border");
        bar.setAttribute("role", "toolbar");
        bar.setAttribute("aria-label", "Source Frames");
        var hint = el(doc, "span", "tweakui-sf-hint");
        var buttons = {};
        function button(key, iconName, text, action, className) {
            var b = el(doc, "button", "btn btn-sm " + (className || "btn-secondary") + " tweakui-sf-" + key);
            b.type = "button";
            b.appendChild(icon(doc, iconName));
            b.appendChild(doc.createTextNode(" " + text));
            b.addEventListener("click", function (e) { e.stopPropagation(); action(); });
            buttons[key] = b;
            bar.appendChild(b);
            return b;
        }
        var mode = null;
        // The tool says when a click finds nothing there (the 3D view's empty space)
        tool.hint = function (text) { hint.textContent = text; };
        function setMode(kind) {
            mode = kind;
            buttons.spot.classList.toggle("active", kind === "spot");
            buttons.area.classList.toggle("active", kind === "area");
            // Not the hidden attribute: Bootstrap's .btn shows it
            buttons.finish.style.display = kind === "area" ? "" : "none";
            hint.textContent = kind === "spot" ? "Click a place." :
                kind === "area" ? "Click the corners; finish on the first one or with Finish." : "";
            container.classList.toggle("tweakui-sf-picking", !!kind);
        }
        function pick(kind) {
            tool.cancel();
            setMode(kind);
            tool.start(kind, function (place) {
                setMode(null);
                onPlace(place);
            });
        }
        button("spot", "fa-crosshairs", "Spot", function () { pick("spot"); });
        button("area", "fa-draw-polygon", "Area", function () { pick("area"); });
        button("finish", "fa-check", "Finish", function () { tool.finish(); }, "btn-primary");
        bar.appendChild(hint);
        var x = el(doc, "button", "close tweakui-sf-bar-close");
        x.type = "button";
        x.title = "Close";
        x.setAttribute("aria-label", "Close");
        x.innerHTML = "&times;";
        x.addEventListener("click", function (e) { e.stopPropagation(); close(); });
        bar.appendChild(x);
        ["click", "dblclick", "mousedown", "pointerdown", "touchstart", "wheel"].forEach(function (t) {
            bar.addEventListener(t, function (e) { e.stopPropagation(); });
        });
        function keys(e) {
            if (e.key === "Escape" && mode && !doc.querySelector(".tweakui-sf-viewer")) {
                tool.cancel();
                setMode(null);
            }
        }
        doc.addEventListener("keydown", keys);
        function close() {
            doc.removeEventListener("keydown", keys);
            tool.cancel();
            setMode(null);
            if (bar.parentNode) bar.parentNode.removeChild(bar);
            if (onClose) onClose();
        }
        container.appendChild(bar);
        pick("spot");
        return {element: bar, close: close, pick: pick};
    }

    // Source Frames on a map or a 3D view: the button's click opens (or closes) the bar; a place opens the window
    function controller(doc, win, container, tool, tasks) {
        var bar = null, box = null;
        function closeWindow() {
            if (box) { var b = box; box = null; b.close(); }
            tool.clear();
        }
        function onPlace(place) {
            // The previous window goes, but not the place just drawn
            if (box) { var b = box; box = null; b.close(true); }
            var state = {area: place.type === "Polygon", multiple: tasks.length > 1};
            box = buildWindow(doc, win, container, state, function (replaced) {
                if (replaced) return;
                box = null;
                tool.clear();
            });
            var mine = box;
            findFrames(win.fetch.bind(win), doc, tasks, place).then(function (result) {
                if (box === mine) mine.show(result);
            });
        }
        return {
            toggle: function () {
                if (bar) { bar.close(); return; }
                bar = buildBar(doc, win, container, tool, onPlace, function () { bar = null; closeWindow(); });
            },
            isOpen: function () { return !!bar; },
            window: function () { return box; }
        };
    }

    // The 2D map's tool: a click is a spot; an area is drawn corner by corner (a polygon of Leaflet's). While it
    // picks, a click on the map is TweakUI's alone (WebODM's map opens a layer's popup on a click): it is taken in
    // the capture phase, unless it ends a drag (the map pans) or lands on a control or TweakUI's bar or window
    function mapTool(L, map) {
        var shape = null, drawing = null, box = map.getContainer();
        var SKIP = ".leaflet-control, .leaflet-popup, .tweakui-sf-bar, .tweakui-sf-window";
        function style() { return {color: "#ffeb3b", weight: 3, fillOpacity: 0.15, interactive: false}; }
        function clear() {
            if (shape) { map.removeLayer(shape); shape = null; }
        }
        function stop() {
            if (!drawing) return;
            box.removeEventListener("pointerdown", drawing.down, true);
            box.removeEventListener("click", drawing.click, true);
            box.removeEventListener("dblclick", drawing.dblclick, true);
            if (drawing.line) map.removeLayer(drawing.line);
            drawing = null;
        }
        function finishArea() {
            if (!drawing || drawing.points.length < 3) return;
            var points = drawing.points.slice(), done = drawing.done;
            stop();
            shape = L.polygon(points, style()).addTo(map);
            var ring = points.map(function (p) { return [p.lng, p.lat]; });
            ring.push(ring[0]);
            done({type: "Polygon", coordinates: [ring]});
        }
        function ours(e) { return !(e.target && e.target.closest && e.target.closest(SKIP)); }
        return {
            start: function (kind, done) {
                clear();
                drawing = {kind: kind, done: done, points: [], line: null, at: null};
                drawing.down = function (e) { drawing.at = ours(e) ? {x: e.clientX, y: e.clientY} : null; };
                drawing.click = function (e) {
                    var at = drawing.at;
                    if (!ours(e)) return;
                    e.stopPropagation();
                    if (at && (Math.abs(e.clientX - at.x) > CLICK_SLOP || Math.abs(e.clientY - at.y) > CLICK_SLOP)) return;
                    var latlng = map.mouseEventToLatLng(e);
                    if (drawing.kind === "spot") {
                        stop();
                        shape = L.circleMarker(latlng, {radius: 8, color: "#ffeb3b", weight: 3, fillOpacity: 0.3, interactive: false}).addTo(map);
                        done({type: "Point", coordinates: [latlng.lng, latlng.lat]});
                        return;
                    }
                    var pts = drawing.points;
                    if (pts.length >= 3) {
                        var first = map.latLngToContainerPoint(pts[0]), here = map.latLngToContainerPoint(latlng);
                        if (first.distanceTo(here) <= CLOSE_PX) { finishArea(); return; }
                    }
                    pts.push(latlng);
                    if (drawing.line) map.removeLayer(drawing.line);
                    drawing.line = (pts.length > 2 ? L.polygon(pts, style()) : L.polyline(pts, style())).addTo(map);
                };
                // A double click finishes an area and doesn't zoom the map
                drawing.dblclick = function (e) {
                    if (!ours(e)) return;
                    e.stopPropagation();
                    e.preventDefault();
                    finishArea();
                };
                box.addEventListener("pointerdown", drawing.down, true);
                box.addEventListener("click", drawing.click, true);
                box.addEventListener("dblclick", drawing.dblclick, true);
            },
            finish: finishArea,
            cancel: stop,
            clear: function () { stop(); clear(); }
        };
    }

    // The 3D view's place: yellow spheres at its points and a line through them, three.js objects of TweakUI's own in
    // the scene. Not Potree's measurements: WebODM saves those with the task's 3D scene
    function modelMarks(THREE, viewer) {
        var group = new THREE.Group(), line = null, points = [], closed = false;
        group.name = pick3d.MARKS;
        group.renderOrder = 999;
        viewer.scene.scene.add(group);
        var color = 0xffeb3b;
        function redraw() {
            if (line) { group.remove(line); line.geometry.dispose(); line.material.dispose(); line = null; }
            if (points.length < 2) return;
            var geometry = new THREE.BufferGeometry().setFromPoints(points);
            var material = new THREE.LineBasicMaterial({color: color, depthTest: false, transparent: true});
            line = new (closed ? THREE.LineLoop : THREE.Line)(geometry, material);
            line.renderOrder = 999;
            group.add(line);
        }
        return {
            add: function (p) {
                // A size that shows from where the place was picked
                var r = Math.max(viewer.scene.getActiveCamera().position.distanceTo(p) * 0.008, 0.05);
                var sphere = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8),
                    new THREE.MeshBasicMaterial({color: color, depthTest: false, transparent: true, opacity: 0.9}));
                sphere.position.copy(p);
                sphere.renderOrder = 999;
                group.add(sphere);
                points.push(p.clone());
                redraw();
            },
            close: function () { closed = true; redraw(); },
            remove: function () {
                viewer.scene.scene.remove(group);
                group.traverse(function (o) {
                    if (o.geometry) o.geometry.dispose();
                    if (o.material) o.material.dispose();
                });
            },
            group: group
        };
    }

    // The 3D view's tool: a click on the point cloud or the model (not a drag, which orbits) is a spot or an area's
    // corner
    function modelTool(win, viewer) {
        var THREE = win.THREE;
        var marks = null, drawing = null, dom = viewer.renderer.domElement;
        function pickAt(e) {
            var hit = pick3d.pick(win, viewer, e.clientX, e.clientY);
            return hit && hit.point;
        }
        function clear() {
            if (marks) { marks.remove(); marks = null; }
        }
        function stop() {
            if (!drawing) return;
            dom.removeEventListener("pointerdown", drawing.down, true);
            dom.removeEventListener("pointerup", drawing.up, true);
            dom.removeEventListener("dblclick", drawing.dblclick, true);
            drawing = null;
        }
        function finishArea() {
            if (!drawing || drawing.points.length < 3) return;
            var points = drawing.points.slice(), done = drawing.done;
            stop();
            marks.close();
            var ring = points.map(function (p) { return [p.x, p.y, p.z]; });
            ring.push(ring[0]);
            done({type: "Polygon", coordinates: [ring], crs: "task"});
        }
        function toScreen(p) {
            var camera = viewer.scene.getActiveCamera(), rect = dom.getBoundingClientRect();
            var v = new THREE.Vector3(p.x, p.y, p.z).project(camera);
            return {x: rect.left + (v.x + 1) / 2 * rect.width, y: rect.top + (1 - v.y) / 2 * rect.height};
        }
        var api = {
            start: function (kind, done) {
                clear();
                marks = modelMarks(THREE, viewer);
                drawing = {kind: kind, done: done, points: [], at: null};
                drawing.down = function (e) { drawing.at = {x: e.clientX, y: e.clientY}; };
                drawing.up = function (e) {
                    var at = drawing.at;
                    drawing.at = null;
                    if (!at || Math.abs(e.clientX - at.x) > CLICK_SLOP || Math.abs(e.clientY - at.y) > CLICK_SLOP) return;
                    if (e.button !== undefined && e.button !== 0) return;
                    var p = pickAt(e);
                    if (!p) {
                        if (api.hint) api.hint("Nothing there: click on the points or the model.");
                        return;
                    }
                    var pts = drawing.points;
                    if (drawing.kind === "area" && pts.length >= 3) {
                        var first = toScreen(pts[0]);
                        if (Math.hypot(first.x - e.clientX, first.y - e.clientY) <= CLOSE_PX) { finishArea(); return; }
                    }
                    pts.push(new THREE.Vector3(p.x, p.y, p.z));
                    marks.add(new THREE.Vector3(p.x, p.y, p.z));
                    if (drawing.kind === "spot") {
                        var d = drawing.done;
                        stop();
                        d({type: "Point", coordinates: [p.x, p.y, p.z], crs: "task"});
                    }
                };
                drawing.dblclick = function (e) { e.stopPropagation(); finishArea(); };
                dom.addEventListener("pointerdown", drawing.down, true);
                dom.addEventListener("pointerup", drawing.up, true);
                dom.addEventListener("dblclick", drawing.dblclick, true);
            },
            finish: finishArea,
            cancel: function () { var was = drawing; stop(); if (was) clear(); },
            clear: function () { stop(); clear(); }
        };
        return api;
    }

    // The button, put before WebODM's Share button in the row of action buttons (as WebODM wraps each plugin's in a
    // div). Not through PluginsAPI's addActionButton: WebODM keeps only the buttons that answer first, so an answer
    // of TweakUI's would push out Snapshot's (which loads a library first), or the reverse
    function addButton(doc, row, onClick) {
        if (!row || row.querySelector(".tweakui-sf-button")) return null;
        var wrap = el(doc, "div", "tweakui-sf-action");
        var b = el(doc, "button", "btn btn-sm btn-secondary tweakui-sf-button");
        b.type = "button";
        b.title = "Source Frames: the photos that show a spot or an area";
        b.setAttribute("aria-label", "Source Frames");
        b.appendChild(icon(doc, "fa-crosshairs"));
        b.addEventListener("click", onClick);
        wrap.appendChild(b);
        var share = null;
        for (var i = 0; i < row.children.length; i++) {
            if (row.children[i].querySelector(".shareButton") || row.children[i].classList.contains("shareButton")) { share = row.children[i]; break; }
        }
        row.insertBefore(wrap, share || row.lastElementChild);
        return b;
    }

    // The 3D view's task: the page gives it as JSON on [data-modelview]
    function modelTask(doc) {
        var node = doc.querySelector("[data-modelview]");
        try {
            return node ? JSON.parse(node.getAttribute("data-task")) : null;
        } catch (e) {
            return null;
        }
    }

    function start(doc, win) {
        var settings = (win.TweakUI && win.TweakUI.settings) || {};
        var P = win.PluginsAPI;
        // The 2D map's action buttons are beside its container (Map.jsx); Leaflet is the page's global
        if (settings.source_frames_2d && P && P.Map && P.Map.didAddControls) {
            P.Map.didAddControls(function (args) {
                var tasks = tasksWithCameras(args && args.tiles), L = win.L;
                if (!tasks.length || !args.map || !L) return;
                var box = args.map.getContainer();
                var row = box.parentNode && box.parentNode.querySelector(".actionButtons");
                var c = controller(doc, win, box, mapTool(L, args.map), tasks);
                addButton(doc, row, function () { c.toggle(); });
            });
        }
        if (settings.source_frames_3d && pick3d) {
            pick3d.whenViewer(doc, win, function (viewer, row) {
                var task = modelTask(doc);
                if (!task || (task.available_assets || []).indexOf("shots.geojson") === -1 || !win.Potree || !win.THREE) return;
                var c = null;
                addButton(doc, row, function () {
                    if (!c) c = controller(doc, win, viewer.renderArea || viewer.renderer.domElement.parentNode, modelTool(win, viewer), [task]);
                    c.toggle();
                });
            });
        }
    }

    return {
        start: start, tasksWithCameras: tasksWithCameras, merge: merge, findFrames: findFrames, overlay: overlay,
        buildWindow: buildWindow, buildBar: buildBar, controller: controller, mapTool: mapTool, modelTool: modelTool, viewer: viewer,
        modelTask: modelTask, formatTime: formatTime, imageUrl: imageUrl, addButton: addButton
    };
});
