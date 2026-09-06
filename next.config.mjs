/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output: copies only the minimal required files into
  // .next/standalone — dramatically reduces Docker image size.
  output: "standalone",
  env: {
    NEXT_TELEMETRY_DISABLED: "1",
  },
};

export default nextConfig;
