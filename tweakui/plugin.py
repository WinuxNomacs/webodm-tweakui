from app.plugins import PluginBase


class Plugin(PluginBase):
    # Loaded on every WebODM page (base.html); paths are relative to public/
    def include_js_files(self):
        return ["main.js"]

    def include_css_files(self):
        return ["main.css"]
