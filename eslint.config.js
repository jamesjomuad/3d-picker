// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    settings: {
      'import/resolver': {
        alias: {
          map: [
            ['@', './src'],
            ['@/assets', './assets'],
          ],
          extensions: ['.js', '.jsx', '.json'],
        },
      },
    },
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
