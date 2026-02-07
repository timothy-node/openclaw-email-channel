# 📧 OpenClaw Email Channel Plugin

> Two-way email communication for your OpenClaw AI assistant via IMAP/SMTP.

```
📥 Inbox                              📤 Reply
From: user@example.com                To: user@example.com
Subject: Help with project            Subject: Re: Help with project
"Can you summarize this?"             "Here's the summary..."
📎 document.txt                       📎 summary.txt
         │                                     ▲
         └──── OpenClaw processes via IMAP ─────┘
```

## ✨ Features

- 📥 **IMAP Monitoring** — Real-time inbox polling with configurable intervals
- 📤 **SMTP Delivery** — Send replies directly from your AI assistant
- 🧵 **Thread Tracking** — Maintains conversation context across email chains
- 🔒 **Sender Allowlist** — Control who can interact with your assistant
- 📎 **Attachments** — Receive and send email attachments *(v0.4.0+)*
- ⚡ **Environment Variables** — Secure credential management via `${VAR}` syntax

---

## 🚀 Installation

### Option A: Git Clone

```bash
mkdir -p ~/.openclaw/extensions
cd ~/.openclaw/extensions
git clone https://github.com/timothy-node/openclaw-email-channel.git email
cd email && npm install
openclaw gateway restart
```

### Option B: Direct URL

Install from `https://github.com/timothy-node/openclaw-email-channel` via OpenClaw extension manager.

---

## ⚙️ Configuration

Add to your `openclaw.json`:

```jsonc
{
  "env": {
    "vars": {
      "EMAIL_APP_PASSWORD": "your-app-password"
    }
  },
  "channels": {
    "email": {
      "enabled": true,
      "imap": {
        "host": "imap.gmail.com",
        "port": 993,
        "secure": true,
        "user": "your@email.com",
        "password": "${EMAIL_APP_PASSWORD}"
      },
      "smtp": {
        "host": "smtp.gmail.com",
        "port": 587,
        "secure": false,
        "user": "your@email.com",
        "password": "${EMAIL_APP_PASSWORD}"
      },
      "fromName": "",                        // optional display name
      "fromAddress": "your@email.com",
      "pollInterval": 30000,                 // ms, default 30s
      "dmPolicy": "allowlist",
      "allowFrom": ["allowed@example.com"],
      "attachmentsDir": "~/.openclaw/media/email-attachments"
    }
  }
}
```

### Key Fields

| Field | Description |
|---|---|
| `pollInterval` | IMAP polling interval in milliseconds (default: `30000`) |
| `dmPolicy` | Set to `"allowlist"` to restrict senders |
| `allowFrom` | Array of allowed sender addresses. Supports domain wildcards like `@example.com` |
| `attachmentsDir` | Directory for saving inbound attachments *(v0.4.0+)* |
| `fromName` | Display name for outbound emails (optional) |

> ⚠️ **Security**: The `allowFrom` array is required when `dmPolicy` is `"allowlist"`. Only emails from listed addresses will be processed.

---

## 📧 Gmail Setup

1. Enable **Two-Step Verification** on your Google account
2. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
3. Create a new app password (name it `OpenClaw Email`)
4. Copy the 16-character password into `env.vars.EMAIL_APP_PASSWORD`

---

## 📎 Attachments *(v0.4.0+)*

### Receiving Attachments

Set `attachmentsDir` in config. Inbound attachments are saved to that directory and their file paths are appended to the message body, so the AI assistant can read and process them.

### Sending Attachments

The outbound `sendText` supports `filePath` / `media` parameters. Attachments are sent via SMTP using nodemailer.

---

## 🔐 Security Best Practices

- **Use environment variables** for passwords — never hardcode credentials
  ```json
  "password": "${EMAIL_APP_PASSWORD}"
  ```
- **Strict allowlist** — only add trusted email addresses
- **App passwords** — use app-specific passwords, not your main account password
- **Regular rotation** — rotate app passwords periodically

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---|---|
| No emails processed | Check `allowFrom` includes the sender address |
| Connection timeout | Verify IMAP/SMTP host and port settings |
| Authentication failed | Regenerate app password; ensure 2FA is enabled |
| Emails not sending | Check SMTP settings and `fromAddress` |
| Attachments not saved | Ensure `attachmentsDir` is set and directory exists |

---

## 🤝 Community

- 💬 Telegram: https://t.me/timothy_node

## 📄 License

[MIT](LICENSE)

---

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178c6)](https://www.typescriptlang.org/)
[![OpenClaw Compatible](https://img.shields.io/badge/OpenClaw-Plugin-orange)](https://github.com/openclaw/openclaw)
