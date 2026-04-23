// Content filter for student-safe messaging.
// Pure function — no side effects. Can be used on client and server.

export type FlagType =
  | "phone_number"
  | "email_address"
  | "social_handle"
  | "external_url"
  | "keyword";

export type FilterResult = {
  ok: boolean;
  hardBlock?: { type: FlagType; match: string };
  softWarn?: { type: FlagType; match: string };
};

const PHONE_RE = /\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const SOCIAL_HANDLE_RE = /(?<![A-Za-z0-9._%+-])@[A-Za-z0-9_]{3,}/;
const URL_RE = /https?:\/\/[^\s]+/;

const CONTACT_PHRASES: { re: RegExp; label: string }[] = [
  { re: /\btext me\b/i, label: "text me" },
  { re: /\bcall me\b/i, label: "call me" },
  { re: /\bdm me\b/i, label: "dm me" },
  { re: /\badd me on\b/i, label: "add me on" },
  { re: /\bmy number is\b/i, label: "my number is" },
  { re: /\bmy email is\b/i, label: "my email is" },
  { re: /\bmy snap\b/i, label: "my snap" },
  { re: /\bmy insta\b/i, label: "my insta" },
  { re: /\bmy discord\b/i, label: "my discord" },
  { re: /\bmy tiktok\b/i, label: "my tiktok" },
  { re: /\bmy whatsapp\b/i, label: "my whatsapp" },
  { re: /\bmy telegram\b/i, label: "my telegram" },
];

export function checkMessage(
  body: string,
  opts: { emailAllowlist?: string[]; urlAllowlist?: string[] } = {}
): FilterResult {
  const emailAllow = opts.emailAllowlist ?? [];
  const urlAllow = opts.urlAllowlist ?? [];

  // Phone
  const phoneMatch = body.match(PHONE_RE);
  if (phoneMatch) {
    return {
      ok: false,
      hardBlock: { type: "phone_number", match: phoneMatch[0] },
    };
  }

  // Email — hard block unless domain is in allowlist
  const emailMatch = body.match(EMAIL_RE);
  if (emailMatch) {
    const email = emailMatch[0];
    const domain = email.split("@")[1]?.toLowerCase() ?? "";
    const allowed = emailAllow.some((a) => {
      const allow = a.toLowerCase();
      return domain === allow || domain.endsWith("." + allow);
    });
    if (!allowed) {
      return {
        ok: false,
        hardBlock: { type: "email_address", match: email },
      };
    }
  }

  // Social handle (@something) — exclude email handles (preceded by word chars)
  const socialMatch = body.match(SOCIAL_HANDLE_RE);
  if (socialMatch) {
    return {
      ok: false,
      hardBlock: { type: "social_handle", match: socialMatch[0] },
    };
  }

  // Contact-invite phrases
  for (const phrase of CONTACT_PHRASES) {
    const m = body.match(phrase.re);
    if (m) {
      return {
        ok: false,
        hardBlock: { type: "keyword", match: m[0] },
      };
    }
  }

  // URL — hard-block? No, soft-warn unless host is allowed.
  const urlMatch = body.match(URL_RE);
  if (urlMatch) {
    const url = urlMatch[0];
    const allowed = isUrlAllowed(url, urlAllow);
    if (!allowed) {
      return {
        ok: true,
        softWarn: { type: "external_url", match: url },
      };
    }
  }

  return { ok: true };
}

export function isUrlAllowed(url: string, allowlist: string[]): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return allowlist.some((a) => {
      const allow = a.toLowerCase();
      return host === allow || host.endsWith("." + allow);
    });
  } catch {
    return false;
  }
}

export function flagLabel(type: FlagType): string {
  switch (type) {
    case "phone_number":
      return "phone number";
    case "email_address":
      return "email address";
    case "social_handle":
      return "social media handle";
    case "external_url":
      return "external link";
    case "keyword":
      return "contact invitation";
  }
}
