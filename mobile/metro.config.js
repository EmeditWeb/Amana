const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Enable minification and optimize for production
config.transformer.minifierConfig = {
  mangle: { toplevel: true },
  compress: {
    drop_console: true,
    passes: 2,
    dead_code: true,
    collapse_vars: true,
    reduce_vars: true,
    pure_getters: true,
    unsafe: true,
    unused: true,
  },
  output: { comments: false },
};

// Optimize asset handling
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== "svg",
);
config.resolver.assetExts.push("svg");

module.exports = config;
