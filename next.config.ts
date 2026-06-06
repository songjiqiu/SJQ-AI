import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const defaultAllowedDevOrigins = ["192.168.0.117"];

const allowedDevOrigins = (
  process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(",") ?? defaultAllowedDevOrigins
)
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins,
  poweredByHeader: false,
  serverExternalPackages: ["@napi-rs/canvas"]
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
