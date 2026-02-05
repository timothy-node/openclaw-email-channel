import type { OpenClawConfig } from "openclaw/plugin-sdk";
import type { EmailConfig } from "./config-schema.js";

export const DEFAULT_ACCOUNT_ID = "default";

export type ResolvedEmailAccount = {
  accountId: string;
  name?: string;
  enabled: boolean;
  configured: boolean;
  config: EmailConfig;
  imap: EmailConfig["imap"];
  smtp: EmailConfig["smtp"];
  fromName: string;
  fromAddress: string;
  pollInterval: number;
  allowFrom: string[];
  attachmentsDir?: string;
  maxAttachmentSize: number;
};

function getEmailSection(cfg: OpenClawConfig): any {
  return (cfg as any).channels?.email ?? (cfg as any).plugins?.entries?.email?.config ?? {};
}

export function listEmailAccountIds(cfg: OpenClawConfig): string[] {
  const section = getEmailSection(cfg);
  if (!section) return [];
  
  // Check for multi-account structure
  if (section.accounts && typeof section.accounts === "object") {
    return Object.keys(section.accounts);
  }
  
  // Single account mode
  if (section.fromAddress || section.imap) {
    return [DEFAULT_ACCOUNT_ID];
  }
  
  return [];
}

export function resolveDefaultEmailAccountId(cfg: OpenClawConfig): string {
  const ids = listEmailAccountIds(cfg);
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

export function resolveEmailAccount(params: {
  cfg: OpenClawConfig;
  accountId?: string | null;
}): ResolvedEmailAccount {
  const { cfg, accountId } = params;
  const aid = accountId ?? DEFAULT_ACCOUNT_ID;
  const section = getEmailSection(cfg);
  
  // Get account-specific config or top-level config
  const accountConfig: Partial<EmailConfig> = 
    section.accounts?.[aid] ?? section ?? {};
  
  const imap = accountConfig.imap;
  const smtp = accountConfig.smtp;
  const fromAddress = accountConfig.fromAddress ?? "";
  
  const configured = Boolean(imap?.host && imap?.user && smtp?.host && smtp?.user && fromAddress);
  const enabled = accountConfig.enabled !== false;
  
  return {
    accountId: aid,
    name: accountConfig.name,
    enabled,
    configured,
    config: accountConfig as EmailConfig,
    imap: imap ?? { host: "", user: "", password: "" },
    smtp: smtp ?? { host: "", user: "", password: "" },
    fromName: accountConfig.fromName ?? "",
    fromAddress,
    pollInterval: accountConfig.pollInterval ?? 30000,
    allowFrom: accountConfig.allowFrom ?? [],
    attachmentsDir: accountConfig.attachmentsDir,
    maxAttachmentSize: accountConfig.maxAttachmentSize ?? 10 * 1024 * 1024,
  };
}
