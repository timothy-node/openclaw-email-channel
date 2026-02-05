# OpenClaw Email Channel Plugin

Two-way email communication with your OpenClaw AI assistant.

## Features

- IMAP inbox monitoring
- SMTP reply delivery
- Email thread tracking
- Sender allowlist
- Attachment support

## Installation

```bash
cd ~/.openclaw/extensions/email
npm install
openclaw gateway restart
```

## Configuration

Add to `openclaw.json`:

```json
{
  "channels": {
    "email": {
      "enabled": true,
      "imap": {
        "host": "imap.gmail.com",
        "port": 993,
        "secure": true,
        "user": "your@gmail.com",
        "password": "your-app-password"
      },
      "smtp": {
        "host": "smtp.gmail.com",
        "port": 587,
        "secure": false,
        "user": "your@gmail.com",
        "password": "your-app-password"
      },
      "fromName": "OpenClaw",
      "fromAddress": "your@gmail.com",
      "pollInterval": 30000,
      "dmPolicy": "allowlist",
      "allowFrom": ["allowed@example.com"]
    }
  }
}
```

## Gmail Setup

1. Enable IMAP in Gmail settings
2. Create App Password: https://myaccount.google.com/apppasswords
3. Use the App Password in config

## License

MIT
