# Storage

## Storage View > Show the Storage view

Off by default.

![The Storage page with a project opened to its tasks](../tweakui/public/previews/storage.webp)

The **Diagnostic** item of the side menu opens to **System** (WebODM's own Diagnostic page) and **Storage**. If an
administrator has turned the Diagnostic plugin off, the **TweakUI** item opens to **Settings** and **Storage**
instead, open from the start.

The Storage page shows how much of your quota is used ("X of Y used", or "X used" without a quota) and the projects
you own, largest first. A project opens to its tasks (status, date, size), with failed, canceled and compactable
tasks marked; a task opens to its files by kind: photos, orthophoto, elevation, point cloud, textured model and
other. Projects shared with you are not listed: they count toward their owner's quota, not yours.

## Cleaning up

Use a row's own **Compact** or **Delete**, or tick several tasks and projects and use the bar's **Compact** or
**Delete** (ticking a project takes in all its tasks). A confirmation lists everything that goes and how much it
frees before anything is done. Compact deletes a completed task's photos and keeps its maps and models (the task
can no longer be restarted). The work is done by WebODM itself, as from the Dashboard, with its own permissions and
quota.

Administrators also see every other user who owns a project, each with their quota and projects, and can clean
them up the same way. TweakUI only reads the task folders, to measure them. It never deletes files itself, so
leftover folders, caches and the processing nodes' copies are out of its reach.
