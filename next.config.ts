import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        /*
         * A tool link IS the credential — see src/lib/tool-runs.ts. Two of the
         * five rules that keep that proportionate are enforced here rather
         * than inside the page, so a new route cannot forget them:
         *
         *  - `no-referrer` stops the token leaking to any third party the page
         *    talks to, or to wherever a child clicks next.
         *  - `noindex` keeps a shared link out of search results.
         */
        source: "/check/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
