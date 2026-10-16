import { PIVOT, transformOrigin } from './geometry';

const processTransformOrigin: (origin: unknown) => unknown = jest.requireActual(
  'react-native/Libraries/StyleSheet/processTransformOrigin',
).default;

test("every pivot survives React Native's own transform-origin parser unchanged", () => {
  expect(processTransformOrigin(transformOrigin(PIVOT.contact))).toEqual(['51.47%', '90.88%', 0]);
  for (const pivot of Object.values(PIVOT)) {
    const origin = transformOrigin(pivot);
    expect(processTransformOrigin(origin)).toEqual(origin);
  }
});
