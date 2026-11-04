/**
 * Clase que encapsula la comunicación con la API de Google Gemini (Actividad 3).
 * Equivale a la clase de OpenAI que pide el enunciado: recibe un prompt y devuelve
 * el texto generado (text completion). Usa fetch, disponible en Node 18+ y en
 * Cloudflare Pages Functions, por lo que no requiere dependencias adicionales.
 */

/** Instrucción de sistema: el modelo debe conservar los tokens tal como llegan. */
export const DEFAULT_SYSTEM_INSTRUCTION =
  'Conserva exactamente los identificadores NAME_, EMAIL_ y PHONE_ que aparezcan en la solicitud. No inventes datos personales.';

/** Error con un código estable que el backend traduce a una respuesta HTTP. */
export class GeminiError extends Error {
  /**
   * @param {string} code GEMINI_CONFIG | GEMINI_API | GEMINI_429 | GEMINI_403 | GEMINI_404
   * @param {string} message Mensaje para el cliente.
   * @param {number} status Código HTTP sugerido.
   */
  constructor(code, message, status) {
    super(message);
    this.name = 'GeminiError';
    this.code = code;
    this.status = status;
  }
}

export class GeminiClient {
  /**
   * @param {{apiKey: string, model?: string, systemInstruction?: string, fetchImpl?: typeof fetch}} options
   *        `fetchImpl` permite inyectar un fetch simulado en las pruebas.
   */
  constructor({apiKey, model = 'gemini-3.5-flash-lite', systemInstruction = DEFAULT_SYSTEM_INSTRUCTION, fetchImpl} = {}) {
    if (!apiKey) throw new GeminiError('GEMINI_CONFIG', 'Gemini no está configurado en el backend.', 503);
    if (!/^[a-zA-Z0-9._-]+$/.test(model)) {
      throw new GeminiError('GEMINI_CONFIG', 'El nombre del modelo configurado no es válido.', 503);
    }
    this.apiKey = apiKey;
    this.model = model;
    this.systemInstruction = systemInstruction;
    this.fetch = fetchImpl || globalThis.fetch.bind(globalThis);
  }

  /**
   * Envía el prompt (ya protegido) a Gemini y devuelve el texto generado.
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  async complete(prompt) {
    let response;
    try {
      response = await this.fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey},
          body: JSON.stringify({
            systemInstruction: {parts: [{text: this.systemInstruction}]},
            contents: [{parts: [{text: prompt}]}]
          })
        }
      );
    } catch {
      throw new GeminiError('GEMINI_API', 'No se pudo conectar con Gemini. Revisa la conectividad del backend.', 502);
    }

    if (!response.ok) {
      if (response.status === 429) throw new GeminiError('GEMINI_429', 'Gemini alcanzó el límite de uso del proyecto.', 429);
      if (response.status === 401 || response.status === 403) {
        throw new GeminiError('GEMINI_403', 'Gemini rechazó la clave o el acceso al proyecto.', 502);
      }
      if (response.status === 404) throw new GeminiError('GEMINI_404', 'El modelo configurado no está disponible para esta clave.', 502);
      throw new GeminiError('GEMINI_API', 'Gemini no pudo completar la solicitud.', 502);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('');
    if (!text) throw new GeminiError('GEMINI_API', 'Gemini no devolvió texto utilizable.', 502);
    return text;
  }
}
