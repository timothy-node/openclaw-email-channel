import { Type, type Static } from "@sinclair/typebox";

export const EmailImapSchema = Type.Object({
  host: Type.String(),
  port: Type.Optional(Type.Number({ default: 993 })),
  secure: Type.Optional(Type.Boolean({ default: true })),
  user: Type.String(),
  password: Type.String(),
});

export const EmailSmtpSchema = Type.Object({
  host: Type.String(),
  port: Type.Optional(Type.Number({ default: 587 })),
  secure: Type.Optional(Type.Boolean({ default: false })),
  user: Type.String(),
  password: Type.String(),
});

export const EmailConfigSchema = Type.Object({
  enabled: Type.Optional(Type.Boolean({ default: true })),
  name: Type.Optional(Type.String()),
  imap: EmailImapSchema,
  smtp: EmailSmtpSchema,
  fromName: Type.Optional(Type.String({ default: "OpenClaw" })),
  fromAddress: Type.String(),
  pollInterval: Type.Optional(Type.Number({ default: 30000 })),
  dmPolicy: Type.Optional(Type.String({ default: "allowlist" })),
  allowFrom: Type.Optional(Type.Array(Type.String())),
  attachmentsDir: Type.Optional(Type.String()),
  maxAttachmentSize: Type.Optional(Type.Number({ default: 10485760 })),
});

export type EmailConfig = Static<typeof EmailConfigSchema>;
