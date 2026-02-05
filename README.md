# OpenClaw Email Channel Plugin

Two-way email communication with your OpenClaw AI assistant.

## Features

- IMAP inbox monitoring
- SMTP reply delivery
- Email thread tracking
- Sender allowlist
- Attachment support

## Installation

### 1. Download Plugin

```bash
# Create extensions directory if it doesn't exist
mkdir -p ~/.openclaw/extensions

# Clone from GitHub
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

## Configuration

Add to `openclaw.json`:

⚠️ **Important**: Must set `allowFrom` with your email addresses or plugin won't process any emails!

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
        "password": "${EMAIL_APP_PASSWORD}"
      },
      "smtp": {
        "host": "smtp.gmail.com",
        "port": 587,
        "secure": false,
        "user": "your@gmail.com",
        "password": "${EMAIL_APP_PASSWORD}"
      },
      "fromName": "",
      "fromAddress": "your@gmail.com",
      "pollInterval": 30000,
      "dmPolicy": "allowlist",
      "allowFrom": ["your@gmail.com", "another@trusted.com"]
    }
  }
}
```

### Using Environment Variables (Recommended)

For security, store passwords in `env.vars` instead of plain text:

```json
{
  "env": {
    "vars": {
      "EMAIL_APP_PASSWORD": "your-app-password-here"
    }
  },
  "channels": {
    "email": {
      "imap": { "password": "${EMAIL_APP_PASSWORD}" },
      "smtp": { "password": "${EMAIL_APP_PASSWORD}" }
    }
  }
}
```

### Key Settings

- **`fromName`**: Sender display name (set to `""` to omit the name and show only the email address)
- **`allowFrom`**: 🔒 **Security whitelist** - Only emails from these addresses will be processed
- **`pollInterval`**: Check for new emails every X milliseconds (30000 = 30 seconds)
- **`dmPolicy`**: Must be `"allowlist"` to use `allowFrom` filtering
- **`imap.timeout`**: IMAP connection timeout in milliseconds (default: 30000)
- **`smtp.timeout`**: SMTP connection timeout in milliseconds (default: 30000)

## Gmail Setup

1. Enable IMAP in Gmail settings
2. Create App Password: https://myaccount.google.com/apppasswords
3. Use the App Password in config

## License

MIT
