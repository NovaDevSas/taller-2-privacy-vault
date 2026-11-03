const $ = id => document.getElementById(id);
const tabs = [...document.querySelectorAll('[data-tab]')];
const pages = [...document.querySelectorAll('.page')];
const sectionNames = {overview:'PANORAMA',lab:'LABORATORIO',flow:'RECORRIDO DEL DATO',vault:'BÓVEDA MONGODB',delivery:'ENTREGA'};

function openTab(id) {
  tabs.forEach(tab => {
    const active = tab.dataset.tab === id;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  pages.forEach(page => {
    const active = page.id === id;
    page.hidden = !active;
    page.classList.toggle('active', active);
  });
  $('section-name').textContent = sectionNames[id] || 'PANORAMA';
  history.replaceState(null, '', `#${id}`);
  if (id === 'lab') $('prompt').focus({preventScroll:true});
}

document.querySelectorAll('[data-tab], [data-tab-link], [data-go]').forEach(control => {
  control.addEventListener('click', event => {
    const id = control.dataset.tab || control.dataset.tabLink || control.dataset.go;
    if (control.tagName === 'A') event.preventDefault();
    openTab(id);
  });
});

tabs.forEach((tab, index) => tab.addEventListener('keydown', event => {
  let next = index;
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % tabs.length;
  else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = tabs.length - 1;
  else return;
  event.preventDefault(); tabs[next].focus(); openTab(tabs[next].dataset.tab);
}));

const initialTab = location.hash.slice(1);
openTab(sectionNames[initialTab] ? initialTab : 'overview');

const checks = [...document.querySelectorAll('[data-check]')];
const savedChecks = JSON.parse(localStorage.getItem('privacy-vault-evidence') || '{}');
checks.forEach(check => {
  check.checked = Boolean(savedChecks[check.dataset.check]);
  check.addEventListener('change', () => {
    const state = Object.fromEntries(checks.map(item => [item.dataset.check,item.checked]));
    localStorage.setItem('privacy-vault-evidence', JSON.stringify(state));
    updateCheckCount();
  });
});
function updateCheckCount() { $('check-count').textContent = `${checks.filter(check=>check.checked).length} / ${checks.length}`; }
updateCheckCount();

async function checkConnection() {
  const badge = $('connection');
  try {
    const response = await fetch('/api/health', {headers:{Accept:'application/json'}});
    const info = await response.json();
    if (!response.ok || !info.ok) throw new Error(info.message || 'Atlas no respondió');
    badge.dataset.state = 'ready';
    badge.querySelector('span').textContent = info.geminiConfigured ? 'Atlas listo · Gemini configurada' : 'Atlas listo · falta Gemini';
  } catch {
    badge.dataset.state = 'error';
    badge.querySelector('span').textContent = 'No se pudo conectar con el backend';
  }
}
checkConnection();

function findLikelyPii(text) {
  const patterns = [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,/(?<!\w)(?:\+?57[\s.-]?)?3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}(?!\w)/g,/\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+\b/g];
  return patterns.flatMap(pattern=>[...text.matchAll(pattern)].map(match=>match[0]));
}

$('send').addEventListener('click', async () => {
  const prompt = $('prompt').value;
  if (!prompt.trim()) { $('lab-status').textContent='Escribe un mensaje de prueba.'; $('prompt').focus(); return; }
  const button = $('send');
  button.disabled = true;
  button.textContent = 'Procesando…';
  $('lab-status').textContent = 'Protegiendo datos y consultando Gemini…';
  $('run-state').textContent = 'EN CURSO';
  $('error-box').hidden = true;
  $('results').hidden = true;
  try {
    const response = await fetch('/api/secureChatGPT', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt})});
    const data = await response.json();
    if (!response.ok) { const error = new Error(data.error || 'No se pudo completar la prueba.'); error.code = data.code; throw error; }
    $('original').textContent = data.original;
    $('ofuscado').textContent = data.ofuscado;
    $('gemini').textContent = data.respuestaGemini;
    $('restaurado').textContent = data.respuestaDesofuscada;
    const found = findLikelyPii(prompt);
    const leaked = found.filter(value=>data.ofuscado.toLocaleLowerCase().includes(value.toLocaleLowerCase()));
    $('privacy-proof').textContent = leaked.length ? `Revisa: ${leaked.length} coincidencia(s) siguen visibles.` : `${found.length} coincidencia(s) de prueba no aparecen en el texto protegido.`;
    $('privacy-proof').style.color = leaked.length ? 'var(--error)' : 'var(--success)';
    $('results').hidden = false;
    $('lab-status').textContent = `Prueba completada · sesión ${data.sessionId.slice(0,8)}…`;
    $('run-state').textContent = 'COMPLETADA';
  } catch (error) {
    $('run-state').textContent = 'REVISAR CONFIGURACIÓN';
    $('lab-status').textContent = 'No se completó la prueba.';
    const messages = {
      MONGODB_CONNECT:'MongoDB Atlas no respondió. Revisa MONGODB_URI, la contraseña del usuario y la lista de IP permitidas.',
      MONGODB_SAVE:'MongoDB se conectó, pero no pudo guardar el mapa. Revisa los permisos del usuario para privacy_vault.mappings.',
      GEMINI_CONFIG:'Falta GEMINI_API_KEY en las variables del entorno del backend.',
      GEMINI_403:'Gemini rechazó la clave o el proyecto no tiene acceso a este modelo.',
      GEMINI_404:'El modelo configurado no está disponible. Comprueba GEMINI_MODEL en el entorno.',
      GEMINI_429:'Gemini alcanzó su límite de uso. Revisa el límite del proyecto o vuelve a probar más tarde.',
      GEMINI_API:'Gemini no pudo completar la solicitud. Comprueba la clave, el modelo y la conexión.'
    };
    const title = document.createElement('b');
    title.textContent = 'No se pudo completar el recorrido.';
    const detail = document.createElement('span');
    detail.textContent = messages[error.code] || error.message || 'Revisa la conexión local y vuelve a intentarlo.';
    $('error-box').replaceChildren(title,detail);
    $('error-box').hidden = false;
  } finally {
    button.disabled = false;
    button.innerHTML = 'Ejecutar prueba <span>→</span>';
  }
});
