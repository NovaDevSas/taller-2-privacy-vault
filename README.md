# Taller 2 · Privacy Vault

Prueba de concepto académica: protege datos identificables de un mensaje con tokens, persiste las correspondencias en MongoDB y consulta Gemini antes de restaurar los tokens de la respuesta. Adaptación del demo de clase (Anthropic/Vercel) a Gemini y Cloudflare Pages.

**Alcance:** solo datos ficticios. La detección con expresiones regulares es incompleta y no garantiza anonimización. Como se conserva el mapa, el proceso es seudonimización. El nivel gratuito de Gemini puede usar contenido para mejorar productos. No usar para datos reales ni decisiones críticas.

## Requisitos

Node.js 20+, MongoDB Atlas accesible desde Cloudflare y una clave de Gemini. Google y MongoDB pueden aplicar límites o cargos según plan y uso; verifica el nivel gratuito en tu cuenta. Las credenciales se usan únicamente del lado servidor.

## Ejecutar localmente

1. `npm install`
2. Copia `.dev.vars.example` como `.dev.vars` y completa `MONGODB_URI`, `MONGODB_DB`, `GEMINI_API_KEY` y `GEMINI_MODEL`. Nunca publiques este archivo.
3. `npm test` y `npm run dev`. Abre la URL que imprime Wrangler y prueba con datos ficticios.

## Desplegar en Cloudflare Pages

Conecta el repositorio. Directorio de salida: `public`; comando de build: `npm install && npm run build`. `wrangler.toml` activa `nodejs_compat`, necesario para empaquetar el driver de MongoDB en Pages Functions. Si Pages usa `npm ci` automático, configura `SKIP_DEPENDENCY_INSTALL=1` para que se ejecute el comando de build personalizado. Configura `MONGODB_URI`, `MONGODB_DB`, `GEMINI_API_KEY` y `GEMINI_MODEL` en **Settings > Variables and Secrets**; guarda las credenciales como secretos. Pages Functions usa MongoDB por TCP, así que Atlas necesita permitir las conexiones salientes de Cloudflare. En este demo el acceso de red de Atlas usa `0.0.0.0/0`: eso permite intentos desde cualquier IPv4. Limita permisos al usuario `taller_privacy_vault`, vigila el consumo y retira esa regla al terminar.

## API

Las peticiones usan JSON:

- `POST /api/anonymize`, `{ "message": "..." }` → `{ anonymizedMessage, sessionId }`.
- `POST /api/deanonymize`, `{ "anonymizedMessage": "...", "sessionId": "..." }` → `{ message }`.
- `POST /api/secureChatGPT` (o `/api/chat`), `{ "prompt": "..." }` → original, ofuscado, respuestaGemini, respuestaDesofuscada y sessionId.
- `GET /api/mappings` → registros de la última sesión, visibles en la pestaña Bóveda.

El mapa se guarda en MongoDB por sesión. El modelo puede alterar u omitir tokens: solo los tokens exactos pueden restaurarse. Las rutas de esta demo no tienen autenticación. La conexión de Gemini tiene límites de consumo; despliega solo para la evaluación del curso y desactiva el proyecto cuando termines.

## Pruebas y evidencias

`npm test` comprueba sustitución, restauración y repetición con datos ficticios. La prueba de extremo a extremo requiere credenciales reales, acceso de red y un modelo habilitado. Registra capturas y resultados reales; no se incluyen evidencias inventadas. El taller original solicita OpenAI: esta implementación usa Gemini por decisión del equipo y debe explicarse al docente.
