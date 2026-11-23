module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expoGoogleDevices/(.*))',
  ],
  moduleNameMapper: {
    // The default template imports src/global.css from constants/theme.js for
    // the web build. Jest has no CSS transform, and no test needs the styles.
    '\\.(css|sass|scss|less)$': '<rootDir>/test/style-mock.js',
  },
};
