# OpenClaw Email Channel Plugin

Two-way email communication for your OpenClaw AI assistant via IMAP/SMTP.

---

## ✨ Features

- 📥 **IMAP Monitoring** — Real-time inbox polling with configurable intervals
- 📤 **SMTP Delivery** — Send replies directly from your AI assistant
- 🧵 **Thread Tracking** — Maintains conversation context across email chains
- 🔒 **Sender Allowlist** — Security whitelist to control who can interact
- 📎 **Attachments** — Support for email attachments
- ⚡ **Environment Variables** — Secure credential management via `${VAR}` syntax

---

## 📸 Screenshots

> **Email Conversation Flow**
>
> ```
> ┌─────────────────────────────────────────────────────────┐
> │  📧 Inbox                                               │
> │  ─────────────────────────────────────────────────────  │
> │  From: user@example.com                                 │
> │  Subject: Help with project                             │
> │  "Can you summarize this document?"                     │
> │                                                         │
> │        ↓ OpenClaw processes via IMAP                    │
> │                                                         │
> │  📤 Sent                                                │
> │  ─────────────────────────────────────────────────────  │
> │  To: user@example.com                                   │
> │  Subject: Re: Help with project                         │
> │  "Here's the summary you requested..."                  │
> └─────────────────────────────────────────────────────────┘
> ```

---

## 🚀 Installation

### 1. Clone the Plugin

```bash
# Create extensions directory
mkdir -p ~/.openclaw/extensions

# Clone repository
cd ~/.openclaw/extensions
git clone https://github.com/timothy-node/openclaw-email-channel.git email
```

### 2. Install Dependencies

```bash
cd ~/.openclaw/extensions/email
npm install
```

### 3. Restart OpenClaw

```bash
openclaw gateway restart
```

---

## ⚙️ Configuration

Add to your `openclaw.json`:

```json
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
      "fromName": "",
      "fromAddress": "your@email.com",
      "pollInterval": 30000,
      "dmPolicy": "allowlist",
      "allowFrom": ["allowed@example.com"]
    }
  }
}
```

> ⚠️ **Security Note**: The `allowFrom` array is required. Only emails from listed addresses will be processed.

---

## 📧 Gmail Setup

### Step 1: Enable IMAP

1. Open Gmail Settings → **See all settings**
2. Go to **Forwarding and POP/IMAP** tab
3. Enable **IMAP Access**
4. Save changes

### Step 2: Create App Password

1. Visit [Google App Passwords](https://myaccount.google.com/apppasswords)
2. Enter app name: **OpenClaw**
3. Click **Create**
4. Copy the 16-character password

### Step 3: Configure OpenClaw

Use the generated app password in `env.vars.EMAIL_APP_PASSWORD`

---

## 🔐 Security Best Practices

1. **Use Environment Variables**
   ```json
   "password": "${EMAIL_APP_PASSWORD}"
   ```
   Never hardcode passwords in config files.

2. **Strict Allowlist**
   Only add trusted email addresses to `allowFrom`.

3. **App Passwords**
   Use app-specific passwords, not your main account password.

4. **Regular Rotation**
   Rotate app passwords periodically.

---

## 🛠️ Troubleshooting

- **No emails processed** — Check `allowFrom` includes sender address
- **Connection timeout** — Verify IMAP/SMTP host and port settings
- **Authentication failed** — Regenerate app password, check `env.vars`
- **Emails not sending** — Confirm SMTP settings and `fromAddress`

---

## 📄 License

MIT

---

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178c6)](https://www.typescriptlang.org/)
[![OpenClaw Compatible](https://img.shields.io/badge/OpenClaw-Plugin-orange)](https://github.com/openclaw/openclaw)
