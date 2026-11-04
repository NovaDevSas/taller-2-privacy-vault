/**
 * Núcleo del Privacy Vault: detección de datos personales con expresiones regulares,
 * sustitución por tokens y restauración.
 *
 * - anonymize(message): reemplaza correos, teléfonos y nombres por tokens únicos
 *   (EMAIL_…, PHONE_…, NAME_…) y devuelve el texto protegido junto con el mapa
 *   [token ↔ dato] que el backend persiste en MongoDB Atlas.
 * - restore(text, mappings): reemplaza los tokens por los datos originales.
 *
 * Como el mapa se conserva, el proceso es seudonimización (reversible), no anonimización.
 */

/** Palabras con mayúscula inicial que no forman parte de un nombre propio. */
const NOT_NAME_WORDS = new Set([
  'hola', 'buenos', 'buenas', 'estimado', 'estimada', 'querido', 'querida', 'señor', 'señora',
  'sr', 'sra', 'don', 'doña', 'doctor', 'doctora', 'ingeniero', 'ingeniera', 'firma', 'firmado',
  'atentamente', 'cordialmente', 'saludos', 'gracias', 'redacta', 'escribe', 'envía', 'crea',
  'genera', 'responde', 'invita', 'contacta', 'el', 'la', 'los', 'las', 'un', 'una', 'para',
  'por', 'con', 'de', 'mi', 'su', 'yo', 'nota', 'asunto', 'oferta', 'lunes', 'martes',
  'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'
]);

/** Primeras palabras que indican una organización o un lugar, no una persona. */
const ORGANIZATION_WORDS = new Set([
  'universidad', 'banco', 'constructora', 'empresa', 'colegio', 'hospital', 'clínica',
  'ministerio', 'alcaldía', 'fundación', 'grupo', 'calle', 'carrera', 'avenida', 'maestría'
]);

const NAME_WORD = '[A-ZÁÉÍÓÚÑ][a-záéíóúñü]+';

/** Patrones en orden de prioridad: primero correo y teléfono, luego nombres. */
const patterns = [
  ['EMAIL', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi],
  // Celular colombiano (3xx) con indicativo +57 opcional y separadores opcionales.
  ['PHONE', /(?<!\w)(?:\+?57[\s.-]?)?3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}(?!\w)/g],
  // Dos o más palabras capitalizadas, admitiendo partículas: "María José Pérez de la Torre".
  ['NAME', new RegExp(`(?<![\\p{L}])${NAME_WORD}(?:\\s+(?:(?:de|del)\\s+(?:(?:la|los|las)\\s+)?)?${NAME_WORD})+(?![\\p{L}])`, 'gu')]
];

/**
 * Limpia un candidato a nombre: elimina saludos, verbos o palabras de firma al inicio
 * ("Hola Dago Borda" → "Dago Borda", "Firma Laura Martínez" → "Laura Martínez").
 * @param {string} candidate Texto que coincidió con el patrón NAME.
 * @returns {{prefix: string, name: string|null}} Texto que se conserva y nombre detectado.
 */
function cleanName(candidate) {
  const words = candidate.split(/\s+/);
  let index = 0;
  while (index < words.length && NOT_NAME_WORDS.has(words[index].toLowerCase())) index++;
  const nameWords = words.slice(index);
  const capitalized = nameWords.filter(word => /^[A-ZÁÉÍÓÚÑ]/.test(word));
  if (capitalized.length < 2 || ORGANIZATION_WORDS.has(nameWords[0]?.toLowerCase())) {
    return {prefix: candidate, name: null};
  }
  const prefix = index ? `${words.slice(0, index).join(' ')} ` : '';
  return {prefix, name: nameWords.join(' ')};
}

/**
 * Protege un mensaje reemplazando los datos personales por tokens.
 * @param {string} message Texto original.
 * @param {(type: string) => string} [makeToken] Generador de tokens (inyectable en pruebas).
 * @returns {{text: string, mappings: Array<{type: string, value: string, token: string}>}}
 */
export function anonymize(message, makeToken = type => `${type}_${crypto.randomUUID().replaceAll('-', '')}`) {
  let text = message;
  const mappings = [];

  /** Reutiliza el token si el mismo dato aparece varias veces en el mensaje. */
  const tokenFor = (type, value) => {
    const existing = mappings.find(m => m.type === type && m.value === value);
    const item = existing || {type, value, token: makeToken(type)};
    if (!existing) mappings.push(item);
    return item.token;
  };

  for (const [type, pattern] of patterns) {
    text = text.replace(pattern, value => {
      if (type !== 'NAME') return tokenFor(type, value);
      const {prefix, name} = cleanName(value);
      return name ? prefix + tokenFor(type, name) : value;
    });
  }
  return {text, mappings};
}

/**
 * Restaura los datos originales a partir del mapa de tokens.
 * Solo se restauran los tokens que el modelo devolvió exactamente iguales.
 * @param {string} text Texto con tokens.
 * @param {Array<{token: string, value: string}>} mappings Mapa leído de MongoDB.
 * @returns {string}
 */
export function restore(text, mappings) {
  for (const {token, value} of mappings) text = text.replaceAll(token, value);
  return text;
}
