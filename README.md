# Taller 2 · Privacy Vault

Prueba de concepto (POC) académica del curso **Inteligencia Artificial para Negocios Digitales** (MAIT · Universidad de los Andes).
El servicio protege los datos identificables de un mensaje (nombres, correos y teléfonos) con tokens, guarda la correspondencia
en **MongoDB Atlas**, consulta **Gemini** solo con el texto protegido y restaura los datos en la respuesta final.

- **Demo publicada:** https://taller-2-privacy-vault.pages.dev
- **Repositorio:** https://github.com/NovaDevSas/taller-2-privacy-vault

> **Alcance:** solo datos ficticios. La detección con expresiones regulares es incompleta y no garantiza anonimización.
> Como se conserva el mapa, el proceso es **seudonimización** (reversible). El nivel gratuito de Gemini puede usar contenido
> para mejorar productos. No usar con datos reales ni para decisiones críticas.

## Cómo funciona

```
Cliente ──mensaje con datos──▶ POST /api/secureChatGPT
                                │ 1. anonymize(): regex → tokens NAME_/EMAIL_/PHONE_
                                │ 2. MongoDB Atlas: guarda {token, value, type, sessionId}
                                │ 3. GeminiClient.complete(): Gemini solo ve los tokens
                                │ 4. restore(): reemplaza los tokens por los datos
Cliente ◀──respuesta restaurada─┘
```

| Actividad del taller | Implementación |
|---|---|
| 1. Live demo: anonimizar y desanonimizar con regex | `lib/vault.js` (`anonymize`, `restore`) · `POST /api/anonymize` · `POST /api/deanonymize` |
| 2. Persistencia en MongoDB Atlas | Colección `privacy_vault.mappings` (token, dato, tipo, sesión, fecha) · `GET /api/mappings` |
| 3. Clase de conexión con el modelo y endpoint `secureChatGPT` | `lib/GeminiClient.js` (clase con `complete(prompt)`) · `POST /api/secureChatGPT` |
| README y prompts | `README.md` · `PROMPTS.md` |

### Adaptaciones frente al enunciado

- **Gemini en lugar de OpenAI.** El equipo usó la API de Google Gemini (`gemini-3.5-flash-lite`) por su nivel gratuito. La clase
  `GeminiClient` cumple el mismo papel que la clase de OpenAI que pide el taller: recibe un prompt y devuelve el *text completion*.
  Cambiar de proveedor solo requiere otra clase con el mismo método `complete()`.
- **Cloudflare Pages Functions en lugar de un servidor Express local.** Los endpoints se ejecutan como funciones serverless en
  Node.js (`nodejs_compat_v2`), lo que permitió publicar la demo con una URL pública para la junta directiva. La lógica (regex,
  tokens, persistencia y orquestación) es la misma del demo de Node/Express.
- **Tokens por sesión.** Cada solicitud genera un `sessionId`; la desanonimización usa los tokens de esa sesión.

## Estructura

```
├── functions/api/[[path]].js   # Endpoints (Pages Functions): anonymize, deanonymize, secureChatGPT, mappings, health
├── lib/vault.js                # Detección con regex, tokens y restauración
├── lib/GeminiClient.js         # Clase de conexión con Gemini (text completion)
├── lib/cloudflare-mongo-tls.js # Adaptador TLS para usar el driver de MongoDB en Cloudflare
├── scripts/patch-mongo-tls.js  # Aplica el adaptador TLS durante el build
├── public/                     # Interfaz web (Resumen, Prueba, Flujo, Bóveda, Entrega)
├── test/                       # Pruebas automáticas (node:test)
├── wrangler.toml               # Configuración de Cloudflare Pages
├── .dev.vars.example           # Plantilla de variables (no subir .dev.vars)
└── PROMPTS.md                  # Prompts usados con el asistente de IA
```

## Requisitos

Node.js 20+, una cuenta de MongoDB Atlas accesible desde Cloudflare y una clave de Gemini (https://aistudio.google.com/apikey).
Google y MongoDB pueden aplicar límites o cargos según el plan; verifica el nivel gratuito en tu cuenta. Las credenciales se usan
únicamente del lado del servidor.

## Ejecutar localmente

1. `npm install`
2. Copia `.dev.vars.example` como `.dev.vars` y completa `MONGODB_URI`, `MONGODB_DB`, `GEMINI_API_KEY` y `GEMINI_MODEL`.
   Nunca publiques este archivo (está en `.gitignore`, igual que `node_modules/`).
3. `npm test` (pruebas sin credenciales) y `npm run dev`. Abre la URL que imprime Wrangler y prueba con datos ficticios.

## Desplegar en Cloudflare Pages

Conecta el repositorio. Directorio de salida: `public`; comando de build: `npm install && npm run build`. `wrangler.toml` activa
`nodejs_compat_v2` para empaquetar MongoDB y define `SKIP_DEPENDENCY_INSTALL=1`, `MONGODB_DB` y `GEMINI_MODEL`. En
**Settings > Variables and Secrets**, guarda `MONGODB_URI` y `GEMINI_API_KEY` como secretos de producción.

Pages Functions se conecta a MongoDB por TCP, así que Atlas debe permitir las conexiones salientes de Cloudflare. En esta demo el
acceso de red de Atlas usa `0.0.0.0/0`, lo que permite intentos desde cualquier IPv4: limita los permisos del usuario
`taller_privacy_vault`, vigila el consumo y retira esa regla al terminar.

## API

Todas las peticiones usan JSON.

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `POST /api/anonymize` | `{ "message": "..." }` | `{ anonymizedMessage, sessionId }` |
| `POST /api/deanonymize` | `{ "anonymizedMessage": "...", "sessionId": "..." }` | `{ message }` |
| `POST /api/secureChatGPT` (o `/api/chat`) | `{ "prompt": "..." }` | `{ original, ofuscado, respuestaGemini, respuestaDesofuscada, sessionId, mapeos }` |
| `GET /api/mappings` | — | Registros de la última sesión (pestaña Bóveda) |
| `GET /api/health` | — | `{ ok, mongodb, geminiConfigured }` |

Ejemplo:

```bash
curl -X POST https://taller-2-privacy-vault.pages.dev/api/anonymize -H "Content-Type: application/json" \
  -d '{"message":"oferta de trabajo para Dago Borda con email dborda@gmail.com y teléfono 3152319157"}'
# {"anonymizedMessage":"oferta de trabajo para NAME_a1f0… con email EMAIL_0b79… y teléfono PHONE_b711…","sessionId":"8adb86e8-…"}

curl -X POST https://taller-2-privacy-vault.pages.dev/api/deanonymize -H "Content-Type: application/json" \
  -d '{"anonymizedMessage":"oferta de trabajo para NAME_a1f0… con email EMAIL_0b79… y teléfono PHONE_b711…","sessionId":"8adb86e8-…"}'
# {"message":"oferta de trabajo para Dago Borda con email dborda@gmail.com y teléfono 3152319157"}
```

El modelo puede alterar u omitir tokens: solo se restauran los tokens que vuelven exactos. Las rutas de esta demo no tienen
autenticación y la conexión de Gemini tiene límites de consumo; despliega solo para la evaluación del curso y desactiva el
proyecto al terminar.

## Pruebas

`npm test` ejecuta 9 pruebas que no requieren credenciales:

- sustitución y restauración, incluso con datos repetidos;
- el ejemplo del enunciado (un token por nombre, correo y teléfono);
- saludos y la palabra "Firma" fuera del nombre; nombres con partículas; teléfonos con +57; organizaciones;
- `GeminiClient` con un `fetch` simulado, comprobando que el modelo **no recibe** datos personales y que la respuesta se restaura;
- traducción de errores de la API (429, configuración faltante).

Las pruebas de extremo a extremo se hicieron sobre la demo publicada con datos ficticios; las capturas están en el informe del taller.
