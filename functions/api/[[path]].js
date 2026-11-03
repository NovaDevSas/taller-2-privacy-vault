import { MongoClient } from 'mongodb';
import { anonymize, restore } from '../../lib/vault.js';

const json = (body, status=200) => Response.json(body, {status, headers:{'Cache-Control':'no-store'}});
async function database(env) {
  if (!env.MONGODB_URI) throw new Error('Falta configurar MongoDB.');
  const client = new MongoClient(env.MONGODB_URI, {serverSelectionTimeoutMS: 8000});
  await client.connect();
  return {client, collection: client.db(env.MONGODB_DB || 'privacy_vault').collection('mappings')};
}
export async function onRequestPost({request, env, params}) {
  if (!env.VAULT_ACCESS_KEY || request.headers.get('Authorization') !== `Bearer ${env.VAULT_ACCESS_KEY}`) return json({error:'Acceso no autorizado.'}, 401);
  const action = (params.path || []).join('/');
  if (!['anonymize','deanonymize','secureChatGPT','chat'].includes(action)) return json({error:'Ruta no encontrada.'},404);
  let body; try { body = await request.json(); } catch { return json({error:'JSON inválido.'},400); }
  const message = action === 'deanonymize' ? body.anonymizedMessage : (body.message ?? body.prompt);
  if (typeof message !== 'string' || !message.trim() || message.length > 5000) return json({error:'El mensaje debe tener entre 1 y 5000 caracteres.'},400);
  let db;
  try {
    db = await database(env);
    if (action === 'deanonymize') {
      if (typeof body.sessionId !== 'string' || !/^[0-9a-f-]{36}$/.test(body.sessionId)) return json({error:'sessionId inválido.'},400);
      const mappings = await db.collection.find({sessionId:body.sessionId}).toArray();
      return json({message:restore(message,mappings)});
    }
    const sessionId = crypto.randomUUID();
    const result = anonymize(message);
    if (result.mappings.length) await db.collection.insertMany(result.mappings.map(m => ({...m,sessionId, createdAt:new Date()})));
    if (action === 'anonymize') return json({anonymizedMessage:result.text,sessionId});
    if (!env.GEMINI_API_KEY) throw new Error('Falta configurar Gemini.');
    const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
    if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error('Modelo inválido.');
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},body:JSON.stringify({systemInstruction:{parts:[{text:'Conserva exactamente los identificadores NAME_, EMAIL_ y PHONE_ que aparezcan en la solicitud. No inventes datos personales.'}]},contents:[{parts:[{text:result.text}]}]})});
    if (!response.ok) throw new Error(`Gemini respondió con estado ${response.status}.`);
    const data = await response.json();
    const generated = data.candidates?.[0]?.content?.parts?.map(p=>p.text || '').join('');
    if (!generated) throw new Error('Gemini no devolvió texto.');
    const mappings = await db.collection.find({sessionId}).toArray();
    return json({original:message,ofuscado:result.text,respuestaGemini:generated,respuestaDesofuscada:restore(generated,mappings),sessionId});
  } catch (error) { console.error('Vault error:', error.message); return json({error:'No fue posible completar la operación. Revisa la configuración y los registros del servidor.'},502); }
  finally { if (db) await db.client.close(); }
}
export function onRequestGet() { return json({error:'Usa POST.'},405); }
