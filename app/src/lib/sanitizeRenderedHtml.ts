import DOMPurify from 'dompurify';

/** Sanitize at HTML sinks: names, listings and messages are untrusted data. */
export function sanitizeRenderedHtml(html: unknown): string {
  return DOMPurify.sanitize(String(html ?? ''), {
    USE_PROFILES: { html: true, svg: true },
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'base', 'meta', 'link', 'style'],
    FORBID_ATTR: ['srcdoc'],
    ALLOW_DATA_ATTR: true,
    ALLOW_ARIA_ATTR: true,
    // Preserve authenticated object-URL identity previews; retain the default
    // protocol policy otherwise (never javascript: or executable data: links).
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    RETURN_TRUSTED_TYPE: false,
  });
}
