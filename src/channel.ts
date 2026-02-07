import {
  formatPairingApproveHint,
  type ChannelPlugin,
} from "openclaw/plugin-sdk";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import * as fs from "fs";
import * as path from "path";

console.log("[email-plugin] channel.ts loaded (patched with attachment support)");

import { getEmailRuntime } from "./runtime.js";
import {
  DEFAULT_ACCOUNT_ID,
  listEmailAccountIds,
  resolveDefaultEmailAccountId,
  resolveEmailAccount,
  type ResolvedEmailAccount,
} from "./types.js";
import { getSmtpTransport, releaseSmtpTransport } from "./smtp-pool.js";
import { conversationStore } from "./conversation-store.js";
import {
  extractEmail,
  extractName,
  getThreadId,
  textToHtml,
  stripQuotedReplies,
  formatEmailAddress,
  matchesAllowlist,
} from "./utils.js";

// Store active polling handles per account
const activePollers = new Map<string, { stop: () => void }>();

/**
 * Send an email reply via SMTP with connection pooling
 */
async function sendEmailReply(
  account: ResolvedEmailAccount,
  to: string,
  subject: string,
  text: string,
  inReplyTo?: string,
  attachments?: Array<{ filename: string; path: string }>
): Promise<void> {
  const smtpConfig = {
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    user: account.smtp.user,
    password: account.smtp.password,
  };

  const transport = await getSmtpTransport(smtpConfig);

  try {
    const mailOptions: any = {
      from: formatEmailAddress(account.fromAddress, account.fromName),
      to: extractEmail(to),
      subject,
      text,
      html: textToHtml(text),
      inReplyTo,
      references: inReplyTo,
    };
    if (attachments?.length) {
      mailOptions.attachments = attachments.map((a) => ({
        filename: a.filename,
        path: a.path,
      }));
    }
    await transport.sendMail(mailOptions);
  } finally {
    releaseSmtpTransport(smtpConfig);
  }
}

/**
 * Check if error is an authentication failure
 */
function isAuthError(err: any): boolean {
  return err.authenticationFailed === true || 
    err.serverResponseCode === 'AUTHENTICATIONFAILED' ||
    err.responseText?.includes('Invalid credentials') ||
    err.response?.includes('AUTHENTICATIONFAILED');
}

/**
 * Create IMAP client with retry logic
 */
async function createImapConnection(
  account: ResolvedEmailAccount,
  log?: { info: Function; warn: Function; error: Function }
): Promise<ImapFlow | null> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = new ImapFlow({
        host: account.imap.host,
        port: account.imap.port ?? 993,
        secure: account.imap.secure ?? true,
        auth: {
          user: account.imap.user,
          pass: account.imap.password,
        },
        logger: false,
        socketTimeout: account.imap.timeout ?? 60000,
      });

      // Prevent uncaught exceptions from socket errors
      client.on('error', (err: Error) => {
        log?.warn?.(`[${account.accountId}] IMAP client error: ${err.message}`);
      });

      await client.connect();
      log?.info?.(`[${account.accountId}] IMAP connected to ${account.imap.host}`);
      return client;
    } catch (err: any) {
      lastError = err;
      
      // Don't retry on auth errors - they won't succeed
      if (isAuthError(err)) {
        log?.error?.(`[${account.accountId}] Authentication failed - check your app password`);
        return null;
      }
      
      log?.warn?.(
        `[${account.accountId}] IMAP connect attempt ${attempt}/${maxRetries} failed: ${err.message}`
      );
      
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }

  log?.error?.(`[${account.accountId}] IMAP connection failed after ${maxRetries} attempts`);
  return null;
}

/**
 * Process incoming emails from IMAP
 */
async function processInbox(
  account: ResolvedEmailAccount,
  imapClient: ImapFlow,
  ctx: any,
  log?: { info: Function; debug: Function; error: Function }
): Promise<number> {
  const runtime = getEmailRuntime();
  let processed = 0;

  const lock = await imapClient.getMailboxLock("INBOX");
  try {
    const messages = await imapClient.search({ seen: false });

    for (const uid of messages) {
      try {
        const message = await imapClient.fetchOne(uid, { source: true });
        if (!message?.source) continue;

        const parsed = await simpleParser(message.source);
        const fromAddr = parsed.from?.value?.[0]?.address || "";
        const fromName = parsed.from?.value?.[0]?.name || extractName(fromAddr);

        // Check allowlist
        if (!matchesAllowlist(fromAddr, account.allowFrom)) {
          log?.debug?.(`[${account.accountId}] Email from ${fromAddr} not in allowlist`);
          await imapClient.messageFlagsAdd(uid, ["\\Seen"]);
          continue;
        }

        const messageId = parsed.messageId || `${Date.now()}@local`;
        const rawText = parsed.text || "";
        const text = stripQuotedReplies(rawText);
        const threadId = getThreadId(fromAddr, account.fromAddress);
        const subject = parsed.subject || "(no subject)";

        // Save attachments if any
        const attachmentPaths: string[] = [];
        log?.info?.(`[${account.accountId}] Attachments count: ${parsed.attachments?.length ?? 0}, dir: ${account.attachmentsDir ?? 'not set'}`);
        if (parsed.attachments?.length && account.attachmentsDir) {
          const dir = account.attachmentsDir;
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          for (const att of parsed.attachments) {
            const safeName = (att.filename || `attachment-${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, "_");
            const filePath = path.join(dir, `${Date.now()}-${safeName}`);
            fs.writeFileSync(filePath, att.content);
            attachmentPaths.push(filePath);
            log?.info?.(`[${account.accountId}] Saved attachment: ${filePath}`);
          }
        }

        // Append attachment info to message text
        let bodyText = text;
        if (attachmentPaths.length > 0) {
          bodyText += "\n\n[Attachments saved to:\n" + attachmentPaths.join("\n") + "]";
        }

        // Store conversation for threading
        conversationStore.set(threadId, {
          threadId,
          lastMessageId: messageId,
          subject,
        });

        log?.info?.(`[${account.accountId}] Email from ${fromAddr}: ${subject}`);

        // Build inbound context for OpenClaw
        const inboundCtx = {
          Surface: "email",
          Provider: "email",
          AccountId: account.accountId,
          From: fromAddr,
          FromName: fromName,
          To: threadId,
          ChatType: "direct",
          Body: bodyText,
          RawBody: rawText,
          MessageSid: messageId,
        };

        // Finalize context and dispatch
        const finalCtx = runtime.channel.reply.finalizeInboundContext(inboundCtx);
        const cfg = runtime.config.loadConfig();

        await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
          ctx: finalCtx,
          cfg,
          dispatcherOptions: {
            deliver: async (payload: { text?: string; media?: string; filePath?: string }) => {
              if (payload.text) {
                const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;
                const atts: Array<{ filename: string; path: string }> = [];
                const aPath = payload.filePath || payload.media;
                if (aPath && typeof aPath === "string" && fs.existsSync(aPath)) {
                  atts.push({ filename: path.basename(aPath), path: aPath });
                }
                await sendEmailReply(account, fromAddr, replySubject, payload.text, messageId, atts);
                log?.info?.(`[${account.accountId}] Reply sent to ${fromAddr}${atts.length ? ` (with ${atts.length} attachment)` : ''}`);
              }
            },
          },
        });

        // Mark as seen
        await imapClient.messageFlagsAdd(uid, ["\\Seen"]);
        processed++;

        ctx?.setStatus?.({
          ...ctx.getStatus?.(),
          lastInboundAt: Date.now(),
        });
      } catch (msgErr: any) {
        log?.error?.(`[${account.accountId}] Error processing message ${uid}: ${msgErr.message}`);
      }
    }
  } finally {
    lock.release();
  }

  return processed;
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
      allowFrom.map((entry) => String(entry).trim().toLowerCase()).filter(Boolean),
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
    normalizeTarget: (target) => extractEmail(target),
    targetResolver: {
      looksLikeId: (input) => input.includes("@"),
      hint: "<email address>",
    },
  },

  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 50000,
    sendText: async ({ to, text, accountId, media, filePath }: any) => {
      const runtime = getEmailRuntime();
      const aid = accountId ?? DEFAULT_ACCOUNT_ID;
      const cfg = runtime.config.loadConfig();
      const account = resolveEmailAccount({ cfg, accountId: aid });

      if (!account.configured) {
        throw new Error("Email not configured");
      }

      const toEmail = extractEmail(to);
      const conv = conversationStore.get(getThreadId(toEmail, account.fromAddress));
      const subject = conv?.subject
        ? conv.subject.startsWith("Re:") ? conv.subject : `Re: ${conv.subject}`
        : "Message";

      // Build attachments from media or filePath
      const attachments: Array<{ filename: string; path: string }> = [];
      const attachPath = filePath || media;
      if (attachPath && typeof attachPath === "string" && fs.existsSync(attachPath)) {
        attachments.push({
          filename: path.basename(attachPath),
          path: attachPath,
        });
      }

      await sendEmailReply(account, toEmail, subject, text, conv?.lastMessageId, attachments);

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

      let imapClient: ImapFlow | null = null;
      let pollTimer: NodeJS.Timeout | null = null;
      let stopped = false;

      // Connect to IMAP
      imapClient = await createImapConnection(account, log);

      // Handle connection failure gracefully
      if (!imapClient) {
        log?.warn(`[${account.accountId}] Email channel stopped - connection failed`);
        ctx.setStatus({
          accountId: account.accountId,
          running: false,
          lastError: 'Connection failed',
          lastStopAt: Date.now(),
        });
        return { stop: async () => {} };
      }

      // Check for new emails
      const checkEmails = async () => {
        if (stopped || !imapClient) return;

        try {
          await processInbox(account, imapClient, ctx, log);
        } catch (error: any) {
          log?.error(`[${account.accountId}] Email check error: ${error.message}`);

          // Attempt to reconnect on connection errors
          if (
            error.message?.includes("connect") ||
            error.message?.includes("socket") ||
            error.message?.includes("ECONNRESET")
          ) {
            log?.info(`[${account.accountId}] Attempting IMAP reconnection...`);
            if (imapClient) {
              try { await imapClient.logout(); } catch {}
            }
            imapClient = await createImapConnection(account, log);
            if (!imapClient) {
              log?.error(`[${account.accountId}] IMAP reconnection failed`);
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
