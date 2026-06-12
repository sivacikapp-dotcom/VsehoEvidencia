import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production"
const isDev = !isProd

// script-src: unsafe-eval is required by Next.js/React in dev; removed in production.
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'"

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'self'",
      "form-action 'self'",
      "base-uri 'self'",
    ].join("; "),
  },
  // HSTS: only in production (requires HTTPS). 2-year max-age per OWASP recommendation.
  ...(isProd ? [{
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          ...securityHeaders,
          // Zakazuje registráciu service workera — zabraňuje stale-chunk problémom v Turbopack
          { key: "Service-Worker-Allowed", value: "" },
          // V dev móde zakáž cachovanie JS chunkov v prehliadači
          ...(isDev
            ? [{ key: "Cache-Control", value: "no-store" }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
