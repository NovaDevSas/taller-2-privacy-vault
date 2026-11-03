const patterns = [
  ['EMAIL', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi],
  ['PHONE', /(?<!\w)(?:\+?57[\s.-]?)?3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}(?!\w)/g],
  ['NAME', /\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+\b/g]
];
export function anonymize(message, makeToken = type => `${type}_${crypto.randomUUID().replaceAll('-', '')}`) {
  let text = message; const mappings = [];
  for (const [type, pattern] of patterns) {
    text = text.replace(pattern, value => {
      const existing = mappings.find(m => m.type === type && m.value === value);
      const item = existing || {type, value, token: makeToken(type)};
      if (!existing) mappings.push(item);
      return item.token;
    });
  }
  return {text, mappings};
}
export function restore(text, mappings) {
  for (const {token, value} of mappings) text = text.replaceAll(token, value);
  return text;
}
