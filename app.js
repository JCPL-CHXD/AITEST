const chat = document.querySelector('#chat');
const form = document.querySelector('#chatForm');
const prompt = document.querySelector('#prompt');
const send = document.querySelector('#send');
const stop = document.querySelector('#stop');
const status = document.querySelector('#status');

const config = await fetch('./Config.json').then(r => {
  if (!r.ok) throw new Error(`Could not load Config.json (${r.status})`);
  return r.json();
});

const worker = new Worker('./worker.js', { type: 'module' });
let currentAssistant = null;
let running = false;

function addMessage(role, text = '') {
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  el.textContent = text;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}

function setRunning(value) {
  running = value;
  send.disabled = value;
  stop.disabled = !value;
  prompt.disabled = value;
}

worker.onmessage = (event) => {
  const data = event.data || {};
  if (data.status === 'loading') status.textContent = 'Loading model...';
  else if (data.status === 'ready') status.textContent = 'Model ready';
  else if (data.status === 'update') {
    if (!currentAssistant) currentAssistant = addMessage('assistant');
    currentAssistant.textContent += data.output || '';
    chat.scrollTop = chat.scrollHeight;
  } else if (data.status === 'complete') {
    status.textContent = 'Ready';
    currentAssistant = null;
    setRunning(false);
  } else if (data.status === 'error') {
    if (!currentAssistant) currentAssistant = addMessage('assistant');
    currentAssistant.textContent = `Error: ${data.output || 'Unknown error'}`;
    currentAssistant = null;
    status.textContent = 'Error';
    setRunning(false);
  }
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (running) return;
  const text = prompt.value.trim();
  if (!text) return;

  addMessage('user', text);
  prompt.value = '';
  currentAssistant = null;
  setRunning(true);
  status.textContent = 'Generating...';

  const defaults = config.defaults;
  const modelName = defaults.model;
  worker.postMessage({
    text,
    model: config.models[modelName] || modelName,
    system_role: config.system_roles[defaults.system_role] || '',
    task: defaults.task,
    device: defaults.device.toLowerCase() === 'auto' ? 'wasm' : defaults.device.toLowerCase(),
    dtype: defaults.dtype.toLowerCase() === 'auto' ? 'auto' : defaults.dtype.toLowerCase(),
    parameters: defaults.config
  });
});

stop.addEventListener('click', () => {
  worker.terminate();
  status.textContent = 'Stopped. Reload the page to start the worker again.';
  setRunning(false);
});
