# Taller 2 · Privacy Vault

Prueba de concepto académica: protege datos identificables de un mensaje con tokens, persiste las correspondencias en MongoDB y consulta Gemini antes de restaurar los tokens de la respuesta. Adaptación del demo de clase (Anthropic/Vercel) a Gemini y Cloudflare Pages.

**Alcance:** solo datos ficticios. La detección por regex es incompleta, puede confundir nombres con otros textos y no garantiza anonimización. Conservar el mapa hace que esto sea seudonimización. El nivel gratuito de Gemini puede usar contenido para mejorar productos. No usar para datos reales ni decisiones críticas.

## Requisitos

Node.js 20+, MongoDB Atlas accesible desde Cloudflare, clave de Gemini y una clave de acceso larga para el demo. Google y MongoDB pueden aplicar límites o cargos según plan y uso; verifica el nivel gratuito en tu cuenta. La API del modelo se usa del lado servidor.

## Ejecutar localmente

1. `npm install`
2. Copia `.dev.vars.example` como `.dev.vars` y completa `MONGODB_URI`, `MONGODB_DB`, `GEMINI_API_KEY`, `GEMINI_MODEL` y `VAULT_ACCESS_KEY`. Nunca publiques este archivo.
3. `npm test` y `npm run dev`. Abre la URL que imprime Wrangler y usa la clave `VAULT_ACCESS_KEY` en la interfaz.

## Desplegar en Cloudflare Pages

Conecta el repositorio. Directorio de salida: `public`; comando de build: `npm run build`; usa una fecha de compatibilidad reciente y la bandera `nodejs_compat` (necesaria para MongoDB). Configura los cinco valores anteriores en **Settings > Variables and Secrets** del proyecto, con las credenciales como secretos. Verifica las reglas de red de Atlas: Cloudflare puede usar direcciones de salida variables; no abras el acceso de una base compartida sin evaluar el riesgo. El despliegue queda a cargo del usuario.

## API

Todas las peticiones usan `Authorization: Bearer <VAULT_ACCESS_KEY>` y JSON:

- `POST /api/anonymize`, `{ "message": "..." }` → `{ anonymizedMessage, sessionId }`.
- `POST /api/deanonymize`, `{ "anonymizedMessage": "...", "sessionId": "..." }` → `{ message }`.
- `POST /api/secureChatGPT` (o `/api/chat`), `{ "prompt": "..." }` → original, ofuscado, respuestaGemini, respuestaDesofuscada y sessionId.

El mapa se guarda en MongoDB por sesión. El modelo puede alterar u omitir tokens: solo los tokens exactos pueden restaurarse. La clave de acceso compartida protege el demo de uso anónimo pero no sustituye autenticación individual, autorización granular ni cifrado de los datos de la base. Configura controles apropiados antes de cualquier uso real.

## Pruebas y evidencias

`npm test` comprueba sustitución, restauración y repetición con datos ficticios. La prueba de extremo a extremo requiere credenciales reales, acceso de red y un modelo habilitado. Registra capturas y resultados reales; no se incluyen evidencias inventadas. El taller original solicita OpenAI: esta implementación usa Gemini por decisión del equipo y debe explicarse al docente.
