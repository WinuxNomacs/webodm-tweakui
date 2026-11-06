# 3D Map

## Controls > Source Frames

Off by default.

![The Source Frames window for a spot picked on the 3D model](../tweakui/public/previews/source-frames-3d.webp)

The same as [Source Frames on the 2D map](./map-2d#controls-source-frames), in a task's 3D view, by clicking the
point cloud or the textured model (a drag still turns the view; a click on empty space says so). The picked
points' own heights are used.

## Controls > Zoom Override

Off by default.

![The 3D view before a zoom, zoomed without and with Zoom Override](../tweakui/public/previews/zoom-override-3d.webp)

The mouse wheel zooms toward what is under the pointer (the point cloud or the textured model) instead of the
middle of the view, and the view then turns around that depth, so any surface can be neared, as closely as wanted.
WebODM's 3D view has no zoom limit as such, but its wheel slows down as it nears the middle of the view and never
passes it. Over empty space, in Potree's other navigation modes and with a pinch on a touch screen, zooming is as
before.
