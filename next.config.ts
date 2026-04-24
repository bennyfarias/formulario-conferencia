import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Libera o acesso pelo seu celular na rede Wi-Fi local
  allowedDevOrigins: ["192.168.1.193"],
};

// next.config.js
module.exports = {
  allowedDevOrigins: ['192.168.100.93'],
}
export default nextConfig;