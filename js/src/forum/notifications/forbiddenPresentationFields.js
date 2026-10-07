export const FORBIDDEN_PRESENTATION_FIELDS = [
  'body',
  'message',
  'preview',
  'snippet',
  'excerpt',
  'lastMessage',
  'rawMessage',
  'transcript',
];

export function assertPresentationSafe(value, path = 'notification') {
  if (value == null || typeof value !== 'object') {
    return value;
  }

  const keys = Object.keys(value);
  for (const key of keys) {
    if (FORBIDDEN_PRESENTATION_FIELDS.includes(key)) {
      throw new Error(`${path}.${key} is not presentation-safe`);
    }
  }

  return value;
}
