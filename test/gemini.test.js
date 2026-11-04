import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GeminiClient, GeminiError} from '../lib/GeminiClient.js';
import {anonymize, restore} from '../lib/vault.js';

/** fetch simulado que responde como la API de Gemini y registra lo que recibe. */
function fakeFetch(capture, {status = 200, reply} = {}) {
  return async (url, init) => {
    capture.url = url;
    capture.body = JSON.parse(init.body);
    const prompt = capture.body.contents[0].parts[0].text;
    const text = reply ?? `Respuesta para ${prompt.match(/NAME_\w+/)?.[0]}`;
    return new Response(JSON.stringify({candidates: [{content: {parts: [{text}]}}]}), {status});
  };
}

test('GeminiClient genera un completion con el modelo configurado', async () => {
  const capture = {};
  const client = new GeminiClient({apiKey: 'test', model: 'gemini-3.5-flash-lite', fetchImpl: fakeFetch(capture)});
  const text = await client.complete('Hola NAME_1');
  assert.equal(text, 'Respuesta para NAME_1');
  assert.match(capture.url, /models\/gemini-3\.5-flash-lite:generateContent$/);
  assert.match(capture.body.systemInstruction.parts[0].text, /NAME_, EMAIL_ y PHONE_/);
});

test('flujo secureChatGPT: el modelo solo recibe tokens y el cliente recibe los datos', async () => {
  const capture = {};
  const prompt = 'Redacta un correo para Dago Borda (dborda@gmail.com, 3152319157)';
  const {text, mappings} = anonymize(prompt);
  const client = new GeminiClient({apiKey: 'test', fetchImpl: fakeFetch(capture)});
  const generated = await client.complete(text);
  const sent = capture.body.contents[0].parts[0].text;
  assert.ok(!/Dago|dborda|3152319157/.test(sent), 'los datos personales no deben llegar al modelo');
  assert.equal(restore(generated, mappings), 'Respuesta para Dago Borda');
});

test('traduce los errores de la API a códigos estables', async () => {
  const client = new GeminiClient({apiKey: 'test', fetchImpl: fakeFetch({}, {status: 429})});
  await assert.rejects(client.complete('x'), e => e instanceof GeminiError && e.code === 'GEMINI_429');
  assert.throws(() => new GeminiClient({}), e => e.code === 'GEMINI_CONFIG');
});
