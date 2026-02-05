import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { emailPlugin } from "./src/channel.js";
import { setEmailRuntime } from "./src/runtime.js";

const plugin = {
  id: "email",
  name: "Email Channel",
  description: "Two-way email communication via IMAP/SMTP",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setEmailRuntime(api.runtime);
    api.registerChannel({ plugin: emailPlugin });
    // gateway.startAccount now works - no workaround needed
  },
};

export default plugin;
