const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Supaya Metro bisa lihat packages di luar folder mobile (monorepo)
config.watchFolders = [workspaceRoot];

// Resolusi node_modules: cari di root workspace dulu, bukan mobile local
// Ini penting supaya React hanya ada 1 instance
config.resolver.nodeModulesPaths = [
  path.resolve(workspaceRoot, 'node_modules'),
  path.resolve(projectRoot, 'node_modules'),
];

// Pastikan React & React Native selalu resolve ke versi yang sama
config.resolver.extraNodeModules = {
  react: path.resolve(workspaceRoot, 'node_modules/react'),
  'react-native': path.resolve(workspaceRoot, 'node_modules/react-native'),
  'react-dom': path.resolve(workspaceRoot, 'node_modules/react-dom'),
};

module.exports = config;
