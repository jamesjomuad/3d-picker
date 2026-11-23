module.exports = {
  preset: 'jest-expo',
  // Reanimated 4 / react-native-worklets load native modules at import time,
  // which crashes jest. Reanimated's resolver chains the worklets one and makes
  // the JS-only modules resolve without their `.native` variants under jest.
  resolver: require.resolve('react-native-reanimated/jest/resolver'),
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expoGoogleDevices/(.*))',
  ],
  moduleNameMapper: {
    // The default template imports src/global.css from constants/theme.js for
    // the web build. Jest has no CSS transform, and no test needs the styles.
    '\\.(css|sass|scss|less)$': '<rootDir>/test/style-mock.js',
  },
};
