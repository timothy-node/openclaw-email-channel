# Changelog

All notable changes to this project will be documented in this file.

## [0.4.0] - 2026-02-07

### Added
- **Inbound Attachment Support** - Incoming email attachments are now saved to `attachmentsDir` and file paths are appended to the message body
- **Outbound Attachment Support** - `sendEmailReply()` now accepts an `attachments` parameter for sending files via SMTP
- **Outbound filePath/media** - `outbound.sendText()` supports `filePath` and `media` parameters for attaching files to outgoing emails
- **Deliver callback attachments** - The inbound `deliver` callback also supports `filePath`/`media` for reply attachments

### Changed
- `sendEmailReply()` signature extended with optional `attachments` array (`{ filename, path }[]`)
- Added `fs` and `path` imports for file operations
- Debug logging for attachment count on each inbound email

## [0.3.1] - 2026-02-07

### Fixed
- **Graceful Auth Error Handling** - Authentication failures no longer crash the gateway
- **Smart Auth Detection** - Detects `AUTHENTICATIONFAILED` errors and stops immediately (no wasted retries)
- **Socket Timeout Prevention** - Added `socketTimeout` (60s default) to prevent hanging connections
- **Uncaught Exception Prevention** - Added error event handlers on IMAP clients

### Changed
- Auth errors now show clear message: `Authentication failed - check your app password`
- Removed misleading retry count for auth errors (was showing `1/3` when it wouldn't retry)
- Connection failures return gracefully instead of throwing

## [0.3.0] - 2026-02-06

### Added
- **SMTP Connection Pooling** - Reuses SMTP connections instead of creating new ones for each email
- **Conversation Store with Cleanup** - Automatically cleans up old conversations (7-day retention, max 1000 entries)
- **Enhanced Utilities Module** - New helper functions for email processing
- **Quoted Reply Stripping** - Automatically removes quoted content from incoming emails
- **URL Auto-linking** - Converts URLs in outgoing emails to clickable links
- **Domain Allowlist Matching** - Support for domain wildcards like `@example.com`

### Changed
- Refactored code into separate modules for better maintainability:
  - `smtp-pool.ts` - SMTP connection pooling
  - `conversation-store.ts` - Thread tracking with auto-cleanup
  - `utils.ts` - Common utility functions
- Reduced channel.ts from ~600 lines to ~350 lines
- Improved HTML email styling with modern font stack
- Better error handling with per-message try-catch

### Removed
- Removed duplicate `startEmailPolling` function (consolidated into `gateway.startAccount`)

### Performance
- SMTP connections are now pooled and reused (5-minute idle timeout)
- Memory usage is bounded by conversation store limits

## [0.2.2] - 2026-02-06

### Changed
- Improved HTML email formatting with proper HTML entity escaping
- Double newlines now create proper `<p>` paragraphs instead of just `<br>`
- Security: HTML special characters (`<`, `>`, `&`, `"`) are now escaped

## [0.2.1] - 2026-02-06

### Added
- CHANGELOG.md for tracking version history
- LICENSE file (MIT)
- Environment variable support documentation in README
- Connection timeout configuration options (`imap.timeout`, `smtp.timeout`)

### Changed
- Improved IMAP connection error handling with automatic reconnection
- `fromName` now defaults to empty string (sender shows email address only)

### Fixed
- IMAP connection not recovering after network interruptions

## [0.2.0] - 2026-02-05

### Added
- Initial release with IMAP/SMTP two-way communication
- Email thread tracking
- Sender allowlist (allowFrom)
- Attachment support
- Multi-account support

### Changed
- Made `fromName` optional (can be empty to show only email address)
