import {
  formatPairingApproveHint,
  type ChannelPlugin,
} from "openclaw/plugin-sdk";
import { ImapFlow } from "imapflow";
import * as nodemailer from "nodemailer";
import { simpleParser } from "mailparser";
// Config schema handled by openclaw.plugin.json
import { getEmailRuntime } from "./runtime.js";
import {
  DEFAULT_ACCOUNT_ID,
  listEmailAccountIds,
  resolveDefaultEmailAccountId,
  resolveEmailAccount,
  type ResolvedEmailAccount,
} from "./types.js";

// Store active polling handles per account
const activePollers = new Map<string, { stop: () => void }>();

// Store conversations for threading
const conversations = new Map<string, {
  threadId: string;
  lastMessageId: string;
  subject: string;
}>();

function extractEmail(addr: string): string {
  const match = addr.match(/<([^>]+)>/);
  return match ? match[1] : addr;
}

function extractName(addr: string): string {
  const match = addr.match(/^([^<]+)</);
  return match ? match[1].trim() : addr.split("@")[0];
}

function getThreadId(from: string, to: string): string {
  const emails = [extractEmail(from), extractEmail(to)].sort();
  return `email:${emails.join(":")}`;
}

// Helper to send email reply via SMTP
async function sendEmailReply(
  account: ResolvedEmailAccount,
  to: string,
  subject: string,
  text: string,
  inReplyTo?: string
): Promise<void> {
  const transport = nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port ?? 587,
    secure: account.smtp.secure ?? false,
    auth: {
      user: account.smtp.user,
      pass: account.smtp.password,
    },
  });

  const fromHeader = account.fromName?.trim()
    ? `"${account.fromName}" <${account.fromAddress}>`
    : `<${account.fromAddress}>`;

  const mailOptions: nodemailer.SendMailOptions = {
    from: fromHeader,
    to: extractEmail(to),
    subject,
    text,
    html: text.replace(/\n/g, "<br>"),
  };

  if (inReplyTo) {
    mailOptions.inReplyTo = inReplyTo;
    mailOptions.references = inReplyTo;
  }

  await transport.sendMail(mailOptions);
  transport.close();
}

export const emailPlugin: ChannelPlugin<ResolvedEmailAccount> = {
  id: "email",
  meta: {
    id: "email",
    label: "Email",
    selectionLabel: "Email (IMAP/SMTP)",
    docsPath: "/channels/email",
    docsLabel: "email",
    blurb: "Two-way email communication via IMAP/SMTP",
    order: 70,
    aliases: ["mail", "smtp", "imap"],
  },
  capabilities: {
    chatTypes: ["direct"],
    media: true,
  },
  reload: { configPrefixes: ["channels.email", "plugins.entries.email"] },

  config: {
    listAccountIds: (cfg) => listEmailAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveEmailAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultEmailAccountId(cfg),
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      fromAddress: account.fromAddress,
    }),
    resolveAllowFrom: ({ cfg, accountId }) =>
      resolveEmailAccount({ cfg, accountId }).allowFrom,
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim().toLowerCase())
        .filter(Boolean),
  },

  pairing: {
    idLabel: "emailAddress",
    normalizeAllowEntry: (entry) => entry.trim().toLowerCase(),
  },

  security: {
    resolveDmPolicy: ({ account }) => ({
      policy: account.config.dmPolicy ?? "allowlist",
      allowFrom: account.allowFrom,
      policyPath: "channels.email.dmPolicy",
      allowFromPath: "channels.email.allowFrom",
      approveHint: formatPairingApproveHint("email"),
      normalizeEntry: (raw) => raw.trim().toLowerCase(),
    }),
  },

  messaging: {
    normalizeTarget: (target) => extractEmail(target).toLowerCase(),
    targetResolver: {
      looksLikeId: (input) => input.includes("@"),
      hint: "<email address>",
    },
  },

  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 50000,
    sendText: async ({ to, text, accountId }) => {
      const runtime = getEmailRuntime();
      const aid = accountId ?? DEFAULT_ACCOUNT_ID;
      const cfg = runtime.config.loadConfig();
      const account = resolveEmailAccount({ cfg, accountId: aid });

      if (!account.configured) {
        throw new Error("Email not configured");
      }

      const transport = nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port ?? 587,
        secure: account.smtp.secure ?? false,
        auth: {
          user: account.smtp.user,
          pass: account.smtp.password,
        },
      });

      const toEmail = extractEmail(to);
      const conv = conversations.get(getThreadId(toEmail, account.fromAddress));
      const subject = conv?.subject
        ? (conv.subject.startsWith("Re:") ? conv.subject : `Re: ${conv.subject}`)
        : "Message";

      const fromHeader = account.fromName?.trim()
        ? `"${account.fromName}" <${account.fromAddress}>`
        : `<${account.fromAddress}>`;

      const mailOptions: nodemailer.SendMailOptions = {
        from: fromHeader,
        to: toEmail,
        subject,
        text,
        html: text.replace(/\n/g, "<br>"),
      };

      if (conv?.lastMessageId) {
        mailOptions.inReplyTo = conv.lastMessageId;
        mailOptions.references = conv.lastMessageId;
      }

      await transport.sendMail(mailOptions);
      transport.close();

      return { channel: "email", to: toEmail };
    },
  },

  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    buildAccountSnapshot: ({ account, runtime }) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      fromAddress: account.fromAddress,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      lastInboundAt: runtime?.lastInboundAt ?? null,
      lastOutboundAt: runtime?.lastOutboundAt ?? null,
    }),
  },

  gateway: {
    startAccount: async (ctx) => {
      const { account, log } = ctx;
      console.log("[email] startAccount called for", account.accountId);
      
      ctx.setStatus({
        accountId: account.accountId,
        fromAddress: account.fromAddress,
        running: true,
        lastStartAt: Date.now(),
      });

      log?.info(`[${account.accountId}] Starting Email provider (${account.fromAddress})`);

      if (!account.configured) {
        throw new Error("Email IMAP/SMTP not configured");
      }

      const runtime = getEmailRuntime();
      let imapClient: ImapFlow | null = null;
      let pollTimer: NodeJS.Timeout | null = null;
      let stopped = false;

      // Initialize IMAP with reconnection support
      const createImapClient = () => new ImapFlow({
        host: account.imap.host,
        port: account.imap.port ?? 993,
        secure: account.imap.secure ?? true,
        auth: {
          user: account.imap.user,
          pass: account.imap.password,
        },
        logger: false,
      });

      const connectImap = async (retries = 3): Promise<void> => {
        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            if (imapClient) {
              try { await imapClient.logout(); } catch {}
            }
            imapClient = createImapClient();
            await imapClient.connect();
            log?.info(`[${account.accountId}] IMAP connected to ${account.imap.host}`);
            return;
          } catch (err: any) {
            log?.warn(`[${account.accountId}] IMAP connect attempt ${attempt}/${retries} failed: ${err.message}`);
            if (attempt === retries) throw err;
            await new Promise(r => setTimeout(r, 2000 * attempt));
          }
        }
      };

      await connectImap();

      // Check for new emails
      const checkEmails = async () => {
        if (stopped || !imapClient) return;

        try {
          const lock = await imapClient.getMailboxLock("INBOX");
          try {
            const messages = await imapClient.search({ seen: false });
            
            for (const uid of messages) {
              if (stopped) break;
              
              const message = await imapClient.fetchOne(uid, { source: true });
              if (!message?.source) continue;

              const parsed = await simpleParser(message.source);
              const fromAddr = parsed.from?.value?.[0]?.address || "";
              const fromName = parsed.from?.value?.[0]?.name || extractName(fromAddr);

              // Check allowlist
              const normalizedFrom = fromAddr.toLowerCase();
              const isAllowed = account.allowFrom.length === 0 || 
                account.allowFrom.some(a => normalizedFrom.includes(a.toLowerCase()));

              if (!isAllowed) {
                log?.debug(`[${account.accountId}] Email from ${fromAddr} not in allowlist`);
                await imapClient.messageFlagsAdd(uid, ["\\Seen"]);
                continue;
              }

              const messageId = parsed.messageId || `${Date.now()}@local`;
              const text = parsed.text || "";
              const threadId = getThreadId(fromAddr, account.fromAddress);

              // Store conversation for threading
              conversations.set(threadId, {
                threadId,
                lastMessageId: messageId,
                subject: parsed.subject || "(no subject)",
              });

              log?.info(`[${account.accountId}] Email from ${fromAddr}: ${parsed.subject}`);

              // Build inbound context for OpenClaw
              const conv = conversations.get(threadId);
              const inboundCtx = {
                Surface: "email",
                Provider: "email", 
                AccountId: account.accountId,
                From: fromAddr,
                FromName: fromName,
                To: threadId,
                ChatType: "direct",
                Body: text,
                RawBody: text,
                MessageSid: messageId,
              };

              // Finalize context and load config
              const finalCtx = runtime.channel.reply.finalizeInboundContext(inboundCtx);
              const cfg = runtime.config.loadConfig();
              
              // Dispatch with buffered dispatcher
              await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
                ctx: finalCtx,
                cfg,
                dispatcherOptions: {
                  deliver: async (payload: { text?: string }) => {
                    if (payload.text) {
                      const subject = conv?.subject
                        ? (conv.subject.startsWith("Re:") ? conv.subject : `Re: ${conv.subject}`)
                        : "Reply";
                      await sendEmailReply(account, fromAddr, subject, payload.text, messageId);
                      log?.info(`[${account.accountId}] Email reply sent to ${fromAddr}`);
                    }
                  },
                },
              });

              // Mark as seen
              await imapClient.messageFlagsAdd(uid, ["\\Seen"]);
              
              ctx.setStatus({
                ...ctx.getStatus(),
                lastInboundAt: Date.now(),
              });
            }
          } finally {
            lock.release();
          }
        } catch (error: any) {
          log?.error(`[${account.accountId}] Email check error: ${error.message}`);
          // Attempt to reconnect on connection errors
          if (error.message?.includes('connect') || error.message?.includes('socket') || error.message?.includes('ECONNRESET')) {
            log?.info(`[${account.accountId}] Attempting IMAP reconnection...`);
            try {
              await connectImap();
            } catch (reconnectErr: any) {
              log?.error(`[${account.accountId}] IMAP reconnection failed: ${reconnectErr.message}`);
            }
          }
        }
      };

      // Initial check
      await checkEmails();

      // Start polling
      pollTimer = setInterval(checkEmails, account.pollInterval);
      log?.info(`[${account.accountId}] Email polling started (every ${account.pollInterval}ms)`);

      // Store handle
      activePollers.set(account.accountId, {
        stop: () => {
          stopped = true;
          if (pollTimer) clearInterval(pollTimer);
          if (imapClient) imapClient.logout().catch(() => {});
        },
      });

      return {
        stop: () => {
          stopped = true;
          if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
          }
          if (imapClient) {
            imapClient.logout().catch(() => {});
            imapClient = null;
          }
          activePollers.delete(account.accountId);
          log?.info(`[${account.accountId}] Email provider stopped`);
        },
      };
    },
  },
};

// Standalone polling function for workaround
export async function startEmailPolling(): Promise<void> {
  const runtime = getEmailRuntime();
  const cfg = runtime.config.loadConfig();
  const accountIds = listEmailAccountIds(cfg);
  
  if (accountIds.length === 0) {
    console.log("[email] No email accounts configured");
    return;
  }
  
  for (const accountId of accountIds) {
    const account = resolveEmailAccount({ cfg, accountId });
    
    if (!account.configured) {
      console.log(`[email] Account ${accountId} not configured`);
      continue;
    }
    
    if (activePollers.has(accountId)) {
      console.log(`[email] Account ${accountId} already polling`);
      continue;
    }
    
    console.log(`[email] Starting polling for ${accountId} (${account.fromAddress})`);
    
    let imapClient: ImapFlow | null = null;
    let pollTimer: NodeJS.Timeout | null = null;
    let stopped = false;
    
    try {
      imapClient = new ImapFlow({
        host: account.imap.host,
        port: account.imap.port ?? 993,
        secure: account.imap.secure ?? true,
        auth: {
          user: account.imap.user,
          pass: account.imap.password,
        },
        logger: false,
      });
      
      await imapClient.connect();
      console.log(`[email] IMAP connected for ${accountId}`);
      
      const checkEmails = async () => {
        if (stopped || !imapClient) return;
        
        try {
          const lock = await imapClient.getMailboxLock("INBOX");
          try {
            const messages = await imapClient.search({ seen: false });
            
            for (const uid of messages) {
              if (stopped) break;
              
              const message = await imapClient.fetchOne(uid, { source: true });
              if (!message?.source) continue;
              
              const parsed = await simpleParser(message.source);
              const fromAddr = parsed.from?.value?.[0]?.address || "";
              const fromName = parsed.from?.value?.[0]?.name || extractName(fromAddr);
              
              // Check allowlist
              const normalizedFrom = fromAddr.toLowerCase();
              const isAllowed = account.allowFrom.length === 0 ||
                account.allowFrom.some(a => normalizedFrom.includes(a.toLowerCase()));
              
              if (!isAllowed) {
                console.log(`[email] Skipping email from ${fromAddr} (not in allowlist)`);
                await imapClient.messageFlagsAdd(uid, ["\\Seen"]);
                continue;
              }
              
              const messageId = parsed.messageId || `${Date.now()}@local`;
              const text = parsed.text || "";
              const threadId = getThreadId(fromAddr, account.fromAddress);
              
              conversations.set(threadId, {
                threadId,
                lastMessageId: messageId,
                subject: parsed.subject || "(no subject)",
              });
              
              console.log(`[email] Received from ${fromAddr}: ${parsed.subject}`);
              
              // Forward to OpenClaw using handleInboundMessage
              const conv = conversations.get(threadId);
              await (runtime.channel.reply as any).handleInboundMessage({
                channel: "email",
                accountId: account.accountId,
                senderId: fromAddr,
                senderName: fromName,
                chatType: "direct",
                chatId: threadId,
                text,
                reply: async (responseText: string) => {
                  const subject = conv?.subject
                    ? (conv.subject.startsWith("Re:") ? conv.subject : `Re: ${conv.subject}`)
                    : "Reply";
                  await sendEmailReply(account, fromAddr, subject, responseText, messageId);
                },
              });
              
              await imapClient.messageFlagsAdd(uid, ["\\Seen"]);
            }
          } finally {
            lock.release();
          }
        } catch (error: any) {
          console.error(`[email] Check error: ${error.message}`);
        }
      };
      
      // Initial check
      await checkEmails();
      
      // Start polling
      pollTimer = setInterval(checkEmails, account.pollInterval);
      console.log(`[email] Polling started (every ${account.pollInterval}ms)`);
      
      activePollers.set(accountId, {
        stop: () => {
          stopped = true;
          if (pollTimer) clearInterval(pollTimer);
          if (imapClient) imapClient.logout().catch(() => {});
          activePollers.delete(accountId);
        },
      });
      
    } catch (error: any) {
      console.error(`[email] Failed to start polling for ${accountId}:`, error.message);
    }
  }
}
