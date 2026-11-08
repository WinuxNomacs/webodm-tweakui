# Administration

## Administration > TweakUI

![Administration > TweakUI with Available to Users](../tweakui/public/previews/admin.webp)

Superusers choose here which of TweakUI's features users may have. TweakUI adds the link after Administration > Theme
in the side menu, beside [TweakUI Themes](themes#published-themes). Other staff don't see it, and the page and its API
refuse them.

**Available to Users** has a checkbox for each feature an administrator may withhold: **Storage View** and
**Performance View**. Both are ticked when TweakUI is installed, so users have them unless a superuser unticks them.
Each change is saved at once.

When a feature is unticked, for every user but superusers (staff included):

- In TweakUI's settings, its setting is greyed with **Turned off by your administrator**, and can't be turned on.
- Its item in the side menu goes, and its page says it is turned off by your administrator.
- Its part of TweakUI's API refuses them.

Each user's own choice is kept. Ticking the feature again gives it back to everyone who had it on, as it was.
Superusers always keep both features, since they need them to look after the server.
