/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  images: {
    remotePatterns: [
      {
        // World Athletics athlete headshots, addressed by athlete id
        protocol: "https",
        hostname: "media.aws.iaaf.org",
        pathname: "/athletes/**",
      },
      {
        // Google account avatars
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default config;
