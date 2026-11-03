import { MongoClient } from 'mongodb';
import { connect } from 'cloudflare:sockets';
import { anonymize, restore } from '../../lib/vault.js';

const json = (body, status=200) => Response.json(body, {status, headers:{'Cache-Control':'no-store'}});
function mongoDiagnostic(error) {
  const message = String(error?.message || '').replace(/mongodb(?:\+srv)?:\/\/[^\s'"`]+/gi, '[MongoDB URI redacted]');
  const servers = error?.reason?.servers;
  const hosts = servers && typeof servers.keys === 'function' ? [...servers.keys()] : [];
  return {name:error?.name || 'Error', code:error?.code || error?.cause?.code || null, message:message.slice(0,240), hosts};
}
async function database(env) {
  if (!env.MONGODB_URI) throw new Error('MONGODB_CONFIG');
  const client = new MongoClient(env.MONGODB_URI, {serverSelectionTimeoutMS:8000, connectTimeoutMS:8000, family:4});
  try {
    await client.connect();
    return {client, collection:client.db(env.MONGODB_DB || 'privacy_vault').collection('mappings')};
  } catch (error) {
    await client.close().catch(()=>{});
    throw error;
  }
}

async function tlsProbe(hostname, port) {
  const started = Date.now();
  let socket;
  try {
    socket = connect({hostname,port},{secureTransport:'on'});
    await Promise.race([
      socket.opened,
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('probe timeout')),6000))
    ]);
    return {ok:true,milliseconds:Date.now()-started};
  } catch (error) {
    return {ok:false,milliseconds:Date.now()-started,error:String(error?.message || error).slice(0,120)};
  } finally {
    if (socket) await socket.close().catch(()=>{});
  }
}

export async function onRequestGet({request,env,params}) {
  const action = (params.path || []).join('/');
  if (!['health','mappings'].includes(action)) return json({error:'Ruta no encontrada.'},404);
  if (action === 'health' && new URL(request.url).searchParams.get('diagnostic') === 'tls') {
    const [atlas,https] = await Promise.all([
      tlsProbe('cluster0-shard-00-00.yrdc4.mongodb.net',27017),
      tlsProbe('www.google.com',443)
    ]);
    return json({atlas,https});
  }
  let db;
  try {
    db = await database(env);
    if (action === 'health') {
      await db.client.db(env.MONGODB_DB || 'privacy_vault').command({ping:1});
      return json({ok:true,mongodb:true,geminiConfigured:Boolean(env.GEMINI_API_KEY)});
    }
    const latest = await db.collection.findOne({}, {sort:{createdAt:-1},projection:{sessionId:1}});
    if (!latest) return json({sessionId:null,mapeos:[]});
    const mapeos = await db.collection.find({sessionId:latest.sessionId})
      .sort({createdAt:1})
      .project({type:1,token:1,value:1,createdAt:1,_id:0})
      .toArray();
    return json({sessionId:latest.sessionId,mapeos});
  } catch (error) {
    console.error('Privacy Vault MongoDB GET:', mongoDiagnostic(error));
    if (action === 'mappings') return json({error:'No se pudieron leer los datos guardados en Atlas.'},503);
    return json({ok:false,mongodb:false,geminiConfigured:Boolean(env.GEMINI_API_KEY),message:'No se pudo comprobar la conexión con MongoDB Atlas.'},503);
  } finally { if (db) await db.client.close().catch(()=>{}); }
}

export async function onRequestPost({request,env,params}) {
  const action = (params.path || []).join('/');
  if (!['anonymize','deanonymize','secureChatGPT','chat'].includes(action)) return json({error:'Ruta no encontrada.'},404);
  let body;
  try { body = await request.json(); } catch { return json({error:'El cuerpo debe ser JSON válido.'},400); }
  const message = action === 'deanonymize' ? body.anonymizedMessage : (body.message ?? body.prompt);
  if (typeof message !== 'string' || !message.trim() || message.length > 5000) return json({error:'El mensaje debe tener entre 1 y 5.000 caracteres.'},400);

  let db;
  let phase = 'MONGODB_CONNECT';
  try {
    db = await database(env);
    if (action === 'deanonymize') {
      if (typeof body.sessionId !== 'string' || !/^[0-9a-f-]{36}$/.test(body.sessionId)) return json({error:'El identificador de sesión no es válido.'},400);
      phase = 'MONGODB_READ';
      const mappings = await db.collection.find({sessionId:body.sessionId}).toArray();
      return json({message:restore(message,mappings)});
    }

    const sessionId = crypto.randomUUID();
    const result = anonymize(message);
    phase = 'MONGODB_SAVE';
    if (result.mappings.length) await db.collection.insertMany(result.mappings.map(mapping=>({...mapping,sessionId,createdAt:new Date()})));
    if (action === 'anonymize') return json({anonymizedMessage:result.text,sessionId});
    if (!env.GEMINI_API_KEY) return json({error:'Gemini no está configurado en el backend.',code:'GEMINI_CONFIG'},503);

    const model = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    if (!/^[a-zA-Z0-9._-]+$/.test(model)) return json({error:'El nombre del modelo configurado no es válido.',code:'GEMINI_CONFIG'},503);
    phase = 'GEMINI_API';
    let response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
        method:'POST',
        headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},
        body:JSON.stringify({
          systemInstruction:{parts:[{text:'Conserva exactamente los identificadores NAME_, EMAIL_ y PHONE_ que aparezcan en la solicitud. No inventes datos personales.'}]},
          contents:[{parts:[{text:result.text}]}]
        })
      });
    } catch { return json({error:'No se pudo conectar con Gemini. Revisa la conectividad del backend.',code:'GEMINI_API'},502); }

    if (!response.ok) {
      if (response.status === 429) return json({error:'Gemini alcanzó el límite de uso del proyecto.',code:'GEMINI_429'},429);
      if (response.status === 403 || response.status === 401) return json({error:'Gemini rechazó la clave o el acceso al proyecto.',code:'GEMINI_403'},502);
      if (response.status === 404) return json({error:'El modelo configurado no está disponible para esta clave.',code:'GEMINI_404'},502);
      return json({error:'Gemini no pudo completar la solicitud.',code:'GEMINI_API'},502);
    }

    const data = await response.json();
    const generated = data.candidates?.[0]?.content?.parts?.map(part=>part.text || '').join('');
    if (!generated) return json({error:'Gemini no devolvió texto utilizable.',code:'GEMINI_API'},502);
    phase = 'MONGODB_READ';
    const mappings = await db.collection.find({sessionId}).toArray();
    const persisted = mappings.map(({type,token,value,createdAt})=>({type,token,value,createdAt}));
    return json({original:message,ofuscado:result.text,respuestaGemini:generated,respuestaDesofuscada:restore(generated,mappings),sessionId,mapeos:persisted});
  } catch (error) {
    console.error(`Privacy Vault ${phase}:`, mongoDiagnostic(error));
    const messages = {
      MONGODB_CONFIG:'Configura MONGODB_URI en las variables del backend.',
      MONGODB_CONNECT:'MongoDB Atlas no respondió. Revisa URI, usuario, contraseña y lista de IP permitidas.',
      MONGODB_SAVE:'MongoDB se conectó, pero no pudo guardar en privacy_vault.mappings. Revisa los permisos del usuario.',
      MONGODB_READ:'MongoDB no pudo leer la sesión. Revisa los permisos del usuario y la disponibilidad de Atlas.'
    };
    return json({error:messages[phase] || 'Ocurrió un error inesperado en el backend.',code:phase},phase.startsWith('MONGODB')?502:500);
  } finally { if (db) await db.client.close().catch(()=>{}); }
}
