# Prompts utilizados

Registro de los prompts que guiaron la construcción del Privacy Vault con asistentes de IA, en el orden de las actividades del
taller. Los prompts base provienen de las notas de clase:
https://mini-octopus-f21.notion.site/Taller-Programar-con-Cursor-para-ejecutivos-407a09f53c9c81d89519fd4176131fea

---

## Actividad 1 · Repetir el live demo

### 1.1 Endpoint de anonimización (prompt del enunciado)

```
I am creating a Data Privacy Vault so that PII (Personally identifiable information) becomes anonymized using node.js.

I need to start with the first step: have an endpoint so that it receives a single string with a message that contains PII
like names, emails and phone numbers and returns it anonymized replacing the whole name, email and phone with an
alphanumeric token.

Please act as an experienced node.js developer and tell me step by step how would you do it. Ask me for information
whenever you need it and use good coding practices and comments in the functions.

An example of the request can be:
curl -X POST http://localhost:3001/anonymize -H "Content-Type: application/json" -d '{"message":"oferta de trabajo para Dago Borda con email dborda@gmail.com y teléfono 3152319157"}'

The response to that request would be:
{"anonymizedMessage": "oferta de trabajo para d7e8e0bf bd673df2 con email b09bde30 y teléfono dd195b6c"}
```

### 1.2 Formato de los tokens

```
Reemplaza el nombre completo por UN solo token, no un token por palabra. Usa el prefijo del tipo de dato
(NAME_, EMAIL_, PHONE_) seguido de un identificador aleatorio, y si el mismo dato aparece varias veces en el mensaje
reutiliza el mismo token. Detecta primero correos, luego celulares colombianos (con +57 opcional) y al final nombres.
```

### 1.3 Endpoint de desanonimización (prompt del enunciado)

```
Thanks. Now, let's implement the deanonymize endpoint where the calling should be like this:
curl -X POST http://localhost:3001/deanonymize -H "Content-Type: application/json" -d '{"anonymizedMessage":"oferta de trabajo para NAME_e1be92e2b3a5 con email EMAIL_8004719c6ea5 y telefono PHONE_40e83067b9cb"}'
and should return the original message:
{"message":"oferta de trabajo para Dago Borda con email dborda@gmail.com y teléfono 3152319157"}
```

### 1.4 Adaptación del entorno

```
Adapta el demo de Node/Express a Cloudflare Pages Functions para tener una URL pública: crea functions/api/[[path]].js
con las rutas POST /api/anonymize y POST /api/deanonymize, deja la lógica de regex y tokens en lib/vault.js para poder
probarla sin servidor y agrega pruebas con node:test. Valida que el cuerpo sea JSON y que el mensaje tenga entre
1 y 5.000 caracteres.
```

---

## Actividad 2 · Persistencia en MongoDB Atlas

### 2.1 Guardar las parejas [dato, token]

```
Añade persistencia en MongoDB para almacenar las parejas [información privada, token]. Usa el driver oficial mongodb,
la base privacy_vault y la colección mappings con los campos type, token, value, sessionId y createdAt. Cada solicitud de
anonimización genera un sessionId; /api/deanonymize debe recibir ese sessionId y leer los tokens de esa sesión.
Lee la cadena de conexión de la variable MONGODB_URI (secreto del backend, nunca en el código).
```

### 2.2 Conexión desde Cloudflare y diagnóstico

```
MongoDB Atlas no responde desde Pages Functions. Agrega un endpoint GET /api/health que haga ping a la base e indique si
Gemini está configurado, registra diagnósticos sin exponer la cadena de conexión, fuerza IPv4 y adapta el TLS del driver
de MongoDB a los sockets de Cloudflare para que funcione con nodejs_compat_v2.
```

### 2.3 Mostrar los registros guardados

```
Agrega GET /api/mappings que devuelva los registros de la última sesión y muéstralos en una pestaña "Bóveda" de la
interfaz con tipo, token, dato original y fecha de guardado.
```

---

## Actividad 3 · Comunicación con la IA

### 3.1 Clase de conexión con el modelo

```
Crea una clase GeminiClient en lib/GeminiClient.js que se conecte con la API de Gemini (generateContent) y genere un
text completion con un método complete(prompt). Debe recibir apiKey y modelo (por defecto gemini-3.5-flash-lite),
incluir una instrucción de sistema para conservar exactamente los tokens NAME_, EMAIL_ y PHONE_, traducir los errores
429, 401/403 y 404 a códigos estables y permitir inyectar un fetch simulado en las pruebas.
```

### 3.2 Endpoint secureChatGPT

```
Now create a new endpoint POST /api/secureChatGPT that:
1. receives a prompt with private information (names, phones and emails),
2. anonymizes it using the functions already implemented,
3. sends the prompt to the model using the GeminiClient class,
4. receives the response and deanonymizes it,
5. sends the response to the final client.
Return original, ofuscado, respuestaGemini, respuestaDesofuscada, sessionId and mapeos so we can show what really
reached the model.
```

### 3.3 Iteración sobre la detección de nombres

```
En la prueba con "Firma Laura Martínez" el regex guardó "Firma Laura Martínez" como nombre. Ajusta la detección para
excluir saludos, verbos y palabras de firma al inicio (Hola, Estimado, Redacta, Firma...), aceptar partículas
(de, del, de la) dentro del nombre y no confundir organizaciones como "Universidad de los Andes". Agrega pruebas.
```

### 3.4 README y prompts

```
Genera un README.md con la descripción del proyecto, la relación con cada actividad del taller, las adaptaciones
(Gemini en lugar de OpenAI, Cloudflare Pages en lugar de Express), la estructura, los pasos para instalarlo,
ejecutarlo y desplegarlo, la API y las pruebas. Incluye en la raíz un archivo PROMPTS.md con los prompts usados.
```
