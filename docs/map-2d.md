# 2D Map

## Controls > Movable Controls

Off by default.

![A map panel dragged away from its usual place](../tweakui/public/previews/movable-controls.webp)

Drag the map's panels (Layers, Base Maps, Measure, Contours, Object Detection, Other Tasks) by their title, with
the mouse or a finger, anywhere within the map. A panel that closes reopens in its usual place.

## Controls > Other Tasks

Off by default.

![The Other Tasks panel with another task's orthophoto shown over the task's own](../tweakui/public/previews/other-tasks.webp)

On a task's map, a button below Layers opens an **Other Tasks** panel listing the project's other tasks that have
an orthophoto. Check one to show its orthophoto over the task's own (cropped as its task is), and set its opacity
with the slider beside it, e.g. to compare before and after. None is shown when the map opens, and nothing is
remembered. A project's own map (Dashboard > the project's **View Map**) already lists every task's layers, so it
has no such button.

## Controls > Source Frames

Off by default.

![The Source Frames window listing the photos that show a spot on the map](../tweakui/public/previews/source-frames-2d.webp)

A button beside **Share** (bottom right of the map) finds the task's photos that show a spot. Click it and a label
"Click Map to View Source Frame" shows at the top of the map while Source Frames is on; each click on the map (not
a drag, which pans) moves the spot there. The first opens a window, and each later one updates it in place: the
photos best first (those where the spot is nearest the middle of the frame), the best one chosen. To look over an
area, move the spot around it.

The chosen photo is shown with the spot drawn on it, with its file name, capture time, camera, size and the
camera's altitude, a **Download** button, and **Open full frame**: the photo full screen, with zoom (wheel, pinch,
buttons, double click), pan, the previous and next photos (arrow keys), and Esc to close. The button again, Esc, or
the window's × turns Source Frames off. A project's map searches each of its tasks with cameras.

How it finds the photos: from each photo's position, direction and lens (the task's camera shots, as WebODM shows
them in its Cameras layer) and the ground's height (the task's DSM; without one, the point cloud's mean height). A
spot counts as shown when it falls inside the photo's frame: something in front of it (a roof, a tree) isn't
detected. Only tasks with camera shots have the button.

## Controls > Zoom Override

Off by default.

![The map at WebODM's closest zoom and 3 steps closer](../tweakui/public/previews/zoom-override-2d.webp)

The map zooms in 3 steps further than WebODM lets it (zoom 27 instead of 24, each step twice as close), with the
wheel, the + button and a pinch. Past the orthophoto's own detail, its pixels are enlarged.
