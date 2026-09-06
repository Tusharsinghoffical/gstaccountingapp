/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use standalone output for Docker, standard output for Render/local
  output: process.env.DOCKER_BUILD ? "standalone" : undefined,
  env: {
    NEXT_TELEMETRY_DISABLED: "1",
  },
};

export default nextConfig;
