/**
 * Extract email address from a formatted string like "Name <email@example.com>"
 */
export function extractEmail(addr: string): string {
  const match = addr.match(/<([^>]+)>/);
  return (match ? match[1] : addr).toLowerCase().trim();
}

/**
 * Extract display name from a formatted string like "Name <email@example.com>"
 */
export function extractName(addr: string): string {
  const match = addr.match(/^([^<]+)</);
  if (match) {
    return match[1].trim().replace(/^["']|["']$/g, "");
  }
  return addr.split("@")[0];
}

/**
 * Generate a consistent thread ID for a conversation between two email addresses
 */
export function getThreadId(from: string, to: string): string {
  const emails = [extractEmail(from), extractEmail(to)].sort();
  return `email:${emails.join(":")}`;
}

/**
 * Convert plain text to properly formatted HTML email
 */
export function textToHtml(text: string): string {
  // Escape HTML entities
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  // Convert URLs to links
  const withLinks = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1">$1</a>'
  );

  // Convert double newlines to paragraphs, single newlines to <br>
  const paragraphs = withLinks.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  
  if (paragraphs.length <= 1) {
    return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.5;">${withLinks.replace(/\n/g, "<br>")}</div>`;
  }

  const html = paragraphs
    .map((p) => `<p style="margin: 0 0 1em 0;">${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n");

  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.5;">${html}</div>`;
}

/**
 * Strip quoted reply content from email body
 */
export function stripQuotedReplies(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    // Stop at common reply markers
    if (
      line.match(/^On .+ wrote:$/i) ||
      line.match(/^>/) ||
      line.match(/^-{3,}/) ||
      line.match(/^_{3,}/) ||
      line.match(/^From:.*@/) ||
      line.match(/^Sent from my/)
    ) {
      break;
    }
    result.push(line);
  }

  return result.join("\n").trim();
}

/**
 * Format email address with optional name
 */
export function formatEmailAddress(email: string, name?: string): string {
  if (name?.trim()) {
    return `"${name.replace(/"/g, '\\"')}" <${email}>`;
  }
  return `<${email}>`;
}

/**
 * Check if an email address matches an allowlist entry
 * Supports wildcards like "*" and domain matching like "@example.com"
 */
export function matchesAllowlist(email: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true;
  
  const normalized = email.toLowerCase().trim();
  
  for (const entry of allowlist) {
    const pattern = entry.toLowerCase().trim();
    
    if (pattern === "*") return true;
    if (pattern === normalized) return true;
    
    // Domain matching: "@example.com" matches any email from that domain
    if (pattern.startsWith("@") && normalized.endsWith(pattern)) {
      return true;
    }
    
    // Partial match (contains)
    if (normalized.includes(pattern)) return true;
  }
  
  return false;
}
