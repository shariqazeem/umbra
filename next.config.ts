import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the file-tracing root to this project. Avoids Next inferring a parent
  // directory as the workspace root when stray lockfiles exist higher up the tree.
  outputFileTracingRoot: projectRoot,
  // Transpile the workspace crypto/wallet packages (they ship raw TS).
  transpilePackages: ["@umbra/crypto-bls", "@umbra/wallet-core"],
  webpack: (config, { webpack, isServer }) => {
    // The workspace packages use ESM-style ".js" import specifiers that actually
    // resolve to ".ts" sources. Teach webpack to follow them.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
      ...(config.resolve.extensionAlias ?? {}),
    };
    // @stellar/stellar-sdk expects a global Buffer in the browser. Provide it on the
    // client bundle only (the server already has Node's Buffer).
    if (!isServer) {
      config.plugins.push(new webpack.ProvidePlugin({ Buffer: ["buffer", "Buffer"] }));
    }
    return config;
  },
};

export default nextConfig;
