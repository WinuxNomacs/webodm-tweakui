---
layout: home
hero:
  name: TweakUI
  text: Small enhancements to WebODM's interface
  tagline: A WebODM plugin. It changes nothing in WebODM itself and can be turned off at any time.
  actions:
    - theme: brand
      text: Features
      link: /general
    - theme: alt
      text: Install
      link: /install
features:
  - title: General
    details: A units menu in the header; a side menu you can narrow, hide, auto-hide or resize; the Task Options dialog counts and shows each group's changed options, and a preset menu sorted A-Z with a filter; a task's details show its times, preset, options, ODX command and current step, and a minimized task keeps its buttons; and fireworks, just for fun.
    link: /general
  - title: Themes
    details: Your own colours for WebODM, from 11 presets, your own themes (imported and exported as JSON) or themes an administrator publishes, with a theme menu in the header.
    link: /themes
  - title: 2D Map
    details: Movable panels, other tasks' orthophotos over the task's own, the photos that show a spot, 3 more zoom steps with the wheel's sensitivity, a search box for an address or coordinates, and a faster map, with tiles kept once drawn and fewer tile requests.
    link: /map-2d
  - title: 3D Map
    details: The photos that show a spot on the model, and a wheel that zooms toward what is under the pointer, as far a notch as you choose.
    link: /map-3d
  - title: Storage
    details: How much of your quota each project and task uses, cleaning them up, and backing up and importing tasks.
    link: /storage
  - title: Performance
    details: Your processing nodes' cores, memory and queue; the server's OS and CPU, its CPU load, memory and disk activity, drawn as graphs over time; recent tasks' times, photos left out and what their logs warn of; and whether the memory suits your tasks.
    link: /performance
  - title: Administration
    details: Superusers choose whether users may have Storage and Performance.
    link: /administration
---

## How it works

Each user has their own TweakUI settings: the **TweakUI** item near the bottom of WebODM's side menu, just above
About, opens them. The settings page has a navigation pane of categories on the left (above the settings on a
phone); it opens on **General**. A change is saved as soon as it is made, which a green **Saved** banner at the
top of the settings confirms for 3 seconds (a red one says why when a change can't be saved), and takes effect on
the next page you open. Each setting says in a line what you get; **More** after it shows the rest (how it works,
what differs on a phone or in WebODM's Windows app). Beside each feature is a screenshot of it; click it to see it
full size. On a phone the screenshot is a **Preview** link under the description.

Every feature is off until you turn it on, except the theme menu.

**Status: experimental.** TweakUI runs on WebODM 3.3.2 or later (tested on 3.3.2 and 4.0.0).
