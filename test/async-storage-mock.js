// Shared AsyncStorage mock for jest: component and store tests reach the
// persistence services (which import AsyncStorage at module load), and the
// native module does not exist under jest. Wired via moduleNameMapper in
// jest.config.js. Suites that need bespoke storage behaviour still override
// it with their own jest.mock factory.
module.exports = require('@react-native-async-storage/async-storage/jest/async-storage-mock');
