# Changelog

All notable changes to this project will be documented in this file.

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
