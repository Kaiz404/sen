// expo-router/testing-library swaps Reanimated for its old mock, which lacks cubicBezier and
// ReducedMotionConfig. Route tests get the same real Reanimated (with setUpTests) as every other test.
module.exports = jest.requireActual('react-native-reanimated');
