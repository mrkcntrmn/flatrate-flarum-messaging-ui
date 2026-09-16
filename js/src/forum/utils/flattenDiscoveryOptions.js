/**
 * Flatten discovery options for keyboard navigation.
 */
export default function flattenDiscoveryOptions(conversations = [], people = []) {
  const options = [];
  for (const conversation of conversations) {
    options.push({ type: 'conversation', conversation });
  }
  for (const person of people) {
    options.push({ type: 'person', person });
  }
  return options;
}
