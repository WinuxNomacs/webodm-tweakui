// 2D Map and 3D Map > Source Frames: a button beside Share, in the map's action buttons, turns Source Frames on;
// while it is on, a label says to click the map, each click on the 2D map or the 3D model moves the one spot there,
// and a window shows the task's photos that see it, best first (by how near the spot is to the frame's centre),
// updated in place: each photo with the spot drawn on it, its properties, a full-screen viewer and a download. The
// photos are found by TweakUI's API (frames.py: the photos' poses and lenses, the ground's height). A project's map
// searches each of its tasks with cameras. Leaflet, Potree and three.js are the page's globals; the 3D pick is
// pick3d.js's. UMD, so Jest can load it.
(function (root, factory) {
    var node = typeof module === "object" && module.exports;
    var api = node ? factory(require("./core"), require("./pick3d")) : factory(root.TweakUI, root.TweakUI.pick3d);
    if (node) module.exports = api;
    else if (root.document) root.TweakUI.feature(root, "source_frames", api.start);
})(typeof window !== "undefined" ? window : this, function (ui, pick3d) {
    "use strict";

    // The WebODM elements it relies on, to check against a new WebODM: the 2D map's row of action buttons and the
    // Share button in it (the 3D view's come through pick3d.js), and the 3D view's task
    var SELECTORS = {mapButtons: ".actionButtons", share: ".shareButton", modelView: "[data-modelview]"};
    var NAME = "source_frames";

    var THUMB = 160, PHOTO = 1024;
    // How far a press may move and still be a click (the map pans and the 3D view orbits on a drag)
    var CLICK_SLOP = 5;
    var LABEL = "Click Map to View Source Frame";

    // Helpers

    var el = ui.el;

    function icon(doc, name) { return el(doc, "i", "fa " + name); }

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
    function merge(results) {
        var all = [];
        results.forEach(function (r) {
            (r.frames || []).forEach(function (f) { f.task = r.task; all.push(f); });
        });
        all.sort(function (a, b) { return a.centre - b.centre; });
        return all;
    }

    // Asks TweakUI's API for the photos of each task that show a spot; resolves to {frames, errors}. `signal`
    // (an AbortSignal) cancels the requests when a newer spot comes
    function findFrames(fetchFn, doc, tasks, place, signal) {
        return Promise.all(tasks.map(function (task) {
            var options = {
                method: "POST", credentials: "same-origin",
                headers: {"Content-Type": "application/json", "X-CSRFToken": ui.csrfToken(doc)},
                body: JSON.stringify(place)
            };
            if (signal) options.signal = signal;
            return fetchFn("/api/plugins/tweakui/frames/" + task.project + "/" + task.id, options).then(function (res) {
                return res.json().then(function (body) {
                    if (!res.ok) throw new Error((body && body.detail) || ("Error " + res.status));
                    return {task: task, frames: body.frames};
                }, function () { throw new Error("Error " + res.status); });
            }).then(null, function (e) { return {task: task, error: e.message}; });
        })).then(function (results) {
            return {
                frames: merge(results.filter(function (r) { return !r.error; })),
                errors: results.filter(function (r) { return r.error; }).map(function (r) {
                    return (tasks.length > 1 ? (r.task.name || "Task #" + r.task.id) + ": " : "") + r.error;
                })
            };
        });
    }

    // The spot drawn on a photo: a ring, in an SVG over it, in fractions of its width and height
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

        keys = ui.guard(NAME, function (e) {
            if (e.key === "Escape") { e.stopPropagation(); close(); }
            else if (e.key === "ArrowLeft") show(index - 1);
            else if (e.key === "ArrowRight") show(index + 1);
            else if (e.key === "+" || e.key === "=") zoom(1.5);
            else if (e.key === "-") zoom(1 / 1.5);
        });
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

    // The window of the photos: the list, best first, and the chosen one with its properties; `show` replaces them
    // for a new spot, `busy` marks a spot's photos being found. Returns {element, close, show, busy, select}
    function buildWindow(doc, win, container, state, onClose) {
        var box = el(doc, "div", "tweakui-sf-window theme-secondary theme-color-primary theme-border");
        box.setAttribute("role", "dialog");
        box.setAttribute("aria-label", "Source Frames");
        var head = el(doc, "div", "tweakui-sf-head theme-background-highlight");
        var title = el(doc, "span", "tweakui-sf-title", "Source Frames");
        var spinner = icon(doc, "fa-spinner fa-spin tweakui-sf-busy");
        spinner.setAttribute("aria-label", "Finding the photos");
        spinner.style.display = "none";
        var closeButton = el(doc, "button", "close tweakui-sf-close");
        closeButton.type = "button";
        closeButton.title = "Close";
        closeButton.setAttribute("aria-label", "Close");
        closeButton.innerHTML = "&times;";
        head.appendChild(title);
        head.appendChild(spinner);
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

        function busy(on) { spinner.style.display = on ? "" : "none"; }

        // As if the window were opened fresh at the spot: the best photo chosen
        function show(result) {
            busy(false);
            if (full) full.close();
            frames = result.frames;
            title.textContent = "Source Frames (" + frames.length + ")";
            body.textContent = "";
            if (result.errors.length) {
                var err = el(doc, "p", "tweakui-sf-message text-danger");
                err.textContent = result.errors.join("; ");
                body.appendChild(err);
            }
            if (!frames.length) {
                if (!result.errors.length) message("No photo shows this spot.", "text-muted");
                return;
            }
            list = el(doc, "div", "tweakui-sf-list theme-border");
            list.setAttribute("role", "listbox");
            list.setAttribute("aria-label", "Photos, best first");
            frames.forEach(function (frame, i) {
                var item = el(doc, "button", "tweakui-sf-item theme-border theme-secondary");
                item.type = "button";
                item.setAttribute("role", "option");
                item.title = frame.filename;
                var thumb = photo(doc, frame, THUMB);
                thumb.querySelector("img").loading = "lazy";
                item.appendChild(thumb);
                item.appendChild(el(doc, "span", "tweakui-sf-caption", "#" + (i + 1)));
                item.addEventListener("click", function () { select(i); });
                list.appendChild(item);
            });
            main = el(doc, "div", "tweakui-sf-main");
            body.appendChild(list);
            body.appendChild(main);
            select(0);
        }

        function close() {
            if (full) full.close();
            if (box.parentNode) box.parentNode.removeChild(box);
            if (onClose) onClose();
        }
        closeButton.addEventListener("click", function () { close(); });

        message("Finding the photos…");
        return {element: box, close: close, show: show, busy: busy, select: function (i) { select(i); }, frames: function () { return frames; }};
    }

    // The label shown while Source Frames is on, with what the tool has to say below it (a click on nothing in the
    // 3D view). Returns {element, hint, remove}
    function buildLabel(doc, container) {
        var label = el(doc, "div", "tweakui-sf-label theme-secondary theme-color-primary theme-border");
        label.setAttribute("role", "status");
        label.appendChild(icon(doc, "fa-crosshairs"));
        label.appendChild(doc.createTextNode(" " + LABEL));
        var hint = el(doc, "div", "tweakui-sf-hint");
        hint.style.display = "none";
        label.appendChild(hint);
        container.appendChild(label);
        return {
            element: label,
            hint: function (text) { hint.textContent = text || ""; hint.style.display = text ? "" : "none"; },
            remove: function () { if (label.parentNode) label.parentNode.removeChild(label); }
        };
    }

    // Source Frames on a map or a 3D view. `tool` is the map's or the 3D view's: {start(onSpot), stop()}, the spot
    // drawn by it and moved on each click until it stops. On: the label, and each spot updates the window (the first
    // opens it); only the latest spot's photos are shown, an older request cancelled. Off (the button again, Esc,
    // the window's close): the label, the spot and the window go. `onChange(on)` tells the button
    function controller(doc, win, container, tool, tasks, onChange) {
        var on = false, label = null, box = null, latest = 0, abort = null;
        function onSpot(place) {
            if (label) label.hint("");
            if (!box) {
                box = buildWindow(doc, win, container, {multiple: tasks.length > 1}, function () { box = null; off(); });
            } else box.busy(true);
            if (abort) abort.abort();
            abort = win.AbortController ? new win.AbortController() : null;
            var mine = ++latest, target = box;
            findFrames(win.fetch.bind(win), doc, tasks, place, abort && abort.signal).then(function (result) {
                if (mine === latest && box === target) target.show(result);
            });
        }
        var keys = ui.guard(NAME, function (e) {
            if (e.key === "Escape" && !doc.querySelector(".tweakui-sf-viewer")) off();
        });
        function off() {
            if (!on) return;
            on = false;
            latest++;
            if (abort) { abort.abort(); abort = null; }
            doc.removeEventListener("keydown", keys);
            tool.stop();
            tool.hint = null;
            if (label) { label.remove(); label = null; }
            container.classList.remove("tweakui-sf-picking");
            if (box) { var b = box; box = null; b.close(); }
            if (onChange) onChange(false);
        }
        function turnOn() {
            on = true;
            label = buildLabel(doc, container);
            tool.hint = label.hint;
            container.classList.add("tweakui-sf-picking");
            doc.addEventListener("keydown", keys);
            tool.start(onSpot);
            if (onChange) onChange(true);
        }
        return {
            toggle: function () { if (on) off(); else turnOn(); },
            off: off,
            isOn: function () { return on; },
            window: function () { return box; }
        };
    }

    // The 2D map's tool: each click moves the spot (a marker of Leaflet's) there. While it is on, a click on the
    // map is TweakUI's alone (WebODM's map opens a layer's popup on a click): it is taken in the capture phase,
    // unless it ends a drag (the map pans) or lands on a control or TweakUI's label or window
    function mapTool(L, map) {
        var marker = null, on = null, box = map.getContainer();
        var SKIP = ".leaflet-control, .leaflet-popup, .tweakui-sf-label, .tweakui-sf-window";
        function ours(e) { return !(e.target && e.target.closest && e.target.closest(SKIP)); }
        function stop() {
            if (on) {
                box.removeEventListener("pointerdown", on.down, true);
                box.removeEventListener("click", on.click, true);
                on = null;
            }
            if (marker) { map.removeLayer(marker); marker = null; }
        }
        return {
            start: function (onSpot) {
                stop();
                on = {at: null};
                on.down = function (e) { on.at = ours(e) ? {x: e.clientX, y: e.clientY} : null; };
                on.click = function (e) {
                    var at = on.at;
                    if (!ours(e)) return;
                    e.stopPropagation();
                    if (at && (Math.abs(e.clientX - at.x) > CLICK_SLOP || Math.abs(e.clientY - at.y) > CLICK_SLOP)) return;
                    var latlng = map.mouseEventToLatLng(e);
                    if (marker) marker.setLatLng(latlng);
                    else marker = L.circleMarker(latlng, {radius: 8, color: "#ffeb3b", weight: 3, fillOpacity: 0.3, interactive: false}).addTo(map);
                    onSpot({type: "Point", coordinates: [latlng.lng, latlng.lat]});
                };
                box.addEventListener("pointerdown", on.down, true);
                box.addEventListener("click", on.click, true);
            },
            stop: stop
        };
    }

    // The 3D view's spot: a yellow sphere, a three.js object of TweakUI's own in the scene. Not Potree's
    // measurements: WebODM saves those with the task's 3D scene
    function modelMark(THREE, viewer) {
        var group = new THREE.Group(), sphere = null;
        group.name = pick3d.MARKS;
        group.renderOrder = 999;
        viewer.scene.scene.add(group);
        function drop() {
            if (!sphere) return;
            group.remove(sphere);
            sphere.geometry.dispose();
            sphere.material.dispose();
            sphere = null;
        }
        return {
            move: function (p) {
                drop();
                // A size that shows from where the spot was picked
                var r = Math.max(viewer.scene.getActiveCamera().position.distanceTo(p) * 0.008, 0.05);
                sphere = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8),
                    new THREE.MeshBasicMaterial({color: 0xffeb3b, depthTest: false, transparent: true, opacity: 0.9}));
                sphere.position.copy(p);
                sphere.renderOrder = 999;
                group.add(sphere);
            },
            remove: function () { drop(); viewer.scene.scene.remove(group); },
            group: group
        };
    }

    // The 3D view's tool: each click on the point cloud or the model (not a drag, which orbits) moves the spot there
    function modelTool(win, viewer) {
        var THREE = win.THREE;
        var mark = null, on = null, dom = viewer.renderer.domElement;
        function stop() {
            if (on) {
                dom.removeEventListener("pointerdown", on.down, true);
                dom.removeEventListener("pointerup", on.up, true);
                on = null;
            }
            if (mark) { mark.remove(); mark = null; }
        }
        var api = {
            start: function (onSpot) {
                stop();
                mark = modelMark(THREE, viewer);
                on = {at: null};
                on.down = function (e) { on.at = {x: e.clientX, y: e.clientY}; };
                on.up = function (e) {
                    var at = on.at;
                    on.at = null;
                    if (!at || Math.abs(e.clientX - at.x) > CLICK_SLOP || Math.abs(e.clientY - at.y) > CLICK_SLOP) return;
                    if (e.button !== undefined && e.button !== 0) return;
                    var hit = pick3d.pick(win, viewer, e.clientX, e.clientY);
                    if (!hit) {
                        if (api.hint) api.hint("Nothing there: click on the points or the model.");
                        return;
                    }
                    var p = hit.point;
                    mark.move(new THREE.Vector3(p.x, p.y, p.z));
                    onSpot({type: "Point", coordinates: [p.x, p.y, p.z], crs: "task"});
                };
                dom.addEventListener("pointerdown", on.down, true);
                dom.addEventListener("pointerup", on.up, true);
            },
            stop: stop
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
        b.title = "Source Frames: the photos that show a spot";
        b.setAttribute("aria-label", "Source Frames");
        b.appendChild(icon(doc, "fa-crosshairs"));
        b.addEventListener("click", onClick);
        wrap.appendChild(b);
        var share = null;
        for (var i = 0; i < row.children.length; i++) {
            var child = row.children[i];
            if (child.querySelector(SELECTORS.share) || child.matches(SELECTORS.share)) { share = child; break; }
        }
        row.insertBefore(wrap, share || row.lastElementChild);
        return b;
    }

    // The button shows when Source Frames is on
    function active(button, on) {
        if (!button) return;
        button.classList.toggle("active", on);
        button.setAttribute("aria-pressed", on ? "true" : "false");
    }

    // The 3D view's task: the page gives it as JSON on [data-modelview]
    function modelTask(doc) {
        var node = doc.querySelector(SELECTORS.modelView);
        try {
            return node ? JSON.parse(node.getAttribute("data-task")) : null;
        } catch (e) {
            return null;
        }
    }

    function start(doc, win) {
        var settings = ui.settingsOf(win);
        var P = win.PluginsAPI;
        // The 2D map's action buttons are beside its container (Map.jsx); Leaflet is the page's global
        if (settings.source_frames_2d && P && P.Map && P.Map.didAddControls) {
            P.Map.didAddControls(ui.guard(NAME, function (args) {
                var tasks = tasksWithCameras(args && args.tiles), L = win.L;
                if (!tasks.length || !args.map || !L) return;
                var box = args.map.getContainer();
                var row = box.parentNode && box.parentNode.querySelector(SELECTORS.mapButtons);
                var button = null;
                var c = controller(doc, win, box, mapTool(L, args.map), tasks, function (on) { active(button, on); });
                button = addButton(doc, row, function () { c.toggle(); });
            }));
        }
        if (settings.source_frames_3d && pick3d) {
            pick3d.whenViewer(doc, win, ui.guard(NAME, function (viewer, row) {
                var task = modelTask(doc);
                if (!task || (task.available_assets || []).indexOf("shots.geojson") === -1 || !win.Potree || !win.THREE) return;
                var c = null, button = null;
                button = addButton(doc, row, function () {
                    if (!c) {
                        c = controller(doc, win, viewer.renderArea || viewer.renderer.domElement.parentNode, modelTool(win, viewer), [task],
                            function (on) { active(button, on); });
                    }
                    c.toggle();
                });
            }));
        }
    }

    return {
        start: start, tasksWithCameras: tasksWithCameras, merge: merge, findFrames: findFrames, overlay: overlay,
        buildWindow: buildWindow, buildLabel: buildLabel, controller: controller, mapTool: mapTool, modelTool: modelTool, viewer: viewer,
        modelTask: modelTask, formatTime: formatTime, imageUrl: imageUrl, addButton: addButton, SELECTORS: SELECTORS
    };
});
