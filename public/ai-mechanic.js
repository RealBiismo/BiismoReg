const signedOut = document.getElementById('aiSignedOut');
const unavailable = document.getElementById('aiUnavailable');
const unavailableText = document.getElementById('aiUnavailableText');
const workspace = document.getElementById('aiWorkspace');
const vehicleSelect = document.getElementById('vehicleSelect');
const issueText = document.getElementById('issueText');
const photoInput = document.getElementById('photoInput');
const photoPreview = document.getElementById('photoPreview');
const startButton = document.getElementById('startDiagnosisButton');
const aiStatus = document.getElementById('aiStatus');
const creditBadge = document.getElementById('creditBadge');
const categoryGrid = document.getElementById('categoryGrid');
const caseList = document.getElementById('caseList');
const newCaseButton = document.getElementById('newCaseButton');
const refreshCasesButton = document.getElementById('refreshCasesButton');
const newCaseView = document.getElementById('newCaseView');
const chatView = document.getElementById('chatView');
const chatMessages = document.getElementById('chatMessages');
const chatVehicle = document.getElementById('chatVehicle');
const chatTitle = document.getElementById('chatTitle');
const chatInput = document.getElementById('chatInput');
const chatPhotoInput = document.getElementById('chatPhotoInput');
const chatPhotoPreview = document.getElementById('chatPhotoPreview');
const sendChatButton = document.getElementById('sendChatButton');
const chatStatus = document.getElementById('chatStatus');
const backToNewButton = document.getElementById('backToNewButton');

let selectedCategory = 'Other';
let newPhotos = [];
let chatPhotos = [];
let currentCaseId = null;
let vehicles = [];
let aiEnabled = false;
let aiQuestions = 0;

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

function setBusy(busy) {
  document.body.classList.toggle('ai-loading', busy);
  startButton.disabled = busy || aiQuestions < 1 || !vehicles.length;
  sendChatButton.disabled = busy || aiQuestions < 1;
}

async function invoke(body) {
  const client = window.biismoAuth.getClient();
  const { data, error } = await client.functions.invoke('ai-mechanic', { body });
  if (error) {
    let message = error.message || 'AI Mechanic could not be reached.';
    try {
      const context = await error.context?.json?.();
      if (context?.error) message = context.error;
    } catch {}
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

function renderQuestionBalance(value) {
  aiQuestions = Math.max(0, Number(value) || 0);
  creditBadge.textContent = `${aiQuestions} AI ${aiQuestions === 1 ? 'question' : 'questions'}`;
  startButton.disabled = aiQuestions < 1 || !vehicles.length;
  sendChatButton.disabled = aiQuestions < 1;
}

async function loadAllowance() {
  try {
    const response = await window.biismoAuth.authorizedFetch('/api/plus/status', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'AI question balance could not be loaded.');
    renderQuestionBalance(data.aiQuestions);
  } catch {
    creditBadge.textContent = 'Questions unavailable';
  }
}

async function loadVehicles() {
  vehicles = await window.biismoAuth.listSavedVehicles();
  if (!vehicles.length) {
    vehicleSelect.innerHTML = '<option value="">No saved vehicles yet</option>';
    startButton.disabled = true;
    aiStatus.innerHTML = 'Save a vehicle to <a href="/account.html">My Garage</a> before starting a diagnosis.';
    return;
  }
  vehicleSelect.innerHTML = '<option value="">Choose a saved vehicle</option>' + vehicles.map(v => {
    const name = [v.make, v.model].filter(Boolean).join(' ');
    return `<option value="${escapeHtml(v.id)}">${escapeHtml(v.registration)} · ${escapeHtml(name || 'Saved vehicle')}</option>`;
  }).join('');
  startButton.disabled = aiQuestions < 1;
}

function renderPhotos(container, photos, onRemove) {
  container.innerHTML = photos.map((photo, index) => `<div class="ai-photo-chip"><img src="${photo}" alt="Selected vehicle photo"><button type="button" data-remove-photo="${index}" aria-label="Remove photo">×</button></div>`).join('');
  container.querySelectorAll('[data-remove-photo]').forEach(button => button.addEventListener('click', () => onRemove(Number(button.dataset.removePhoto))));
}

async function fileToPreparedDataUrl(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Choose a photo from your device.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    const max = 1600;
    const scale = Math.min(1, max / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, width, height);
    let quality = .82;
    let data = canvas.toDataURL('image/jpeg', quality);
    while (data.length > 2_300_000 && quality > .5) {
      quality -= .08;
      data = canvas.toDataURL('image/jpeg', quality);
    }
    if (data.length > 2_500_000) throw new Error('That photo is too large. Try a smaller image.');
    return data;
  } catch {
    throw new Error('That photo could not be prepared. Try selecting it again from Photos.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function addFiles(fileList, target) {
  const existing = target === 'new' ? newPhotos : chatPhotos;
  const remaining = Math.max(0, 3 - existing.length);
  const files = [...fileList].slice(0, remaining);
  if (!files.length) return;
  const prepared = [];
  for (const file of files) prepared.push(await fileToPreparedDataUrl(file));
  if (target === 'new') {
    newPhotos = [...newPhotos, ...prepared];
    renderPhotos(photoPreview, newPhotos, i => { newPhotos.splice(i,1); renderPhotos(photoPreview,newPhotos,j=>{newPhotos.splice(j,1);renderPhotos(photoPreview,newPhotos,()=>{});}); });
  } else {
    chatPhotos = [...chatPhotos, ...prepared];
    renderPhotos(chatPhotoPreview, chatPhotos, i => { chatPhotos.splice(i,1); renderPhotos(chatPhotoPreview,chatPhotos,j=>{chatPhotos.splice(j,1);renderPhotos(chatPhotoPreview,chatPhotos,()=>{});}); });
  }
}

function renderMessages(messages) {
  chatMessages.innerHTML = (messages || []).map(message => `<div class="ai-message ${message.role === 'user' ? 'is-user' : 'is-assistant'}"><small>${message.role === 'user' ? 'You' : 'BIISMO AI Mechanic'}</small>${escapeHtml(message.content)}</div>`).join('');
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendMessage(role, content) {
  const div = document.createElement('div');
  div.className = `ai-message ${role === 'user' ? 'is-user' : 'is-assistant'}`;
  div.innerHTML = `<small>${role === 'user' ? 'You' : 'BIISMO AI Mechanic'}</small>${escapeHtml(content)}`;
  chatMessages.append(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showNewCase() {
  currentCaseId = null;
  newCaseView.hidden = false;
  chatView.hidden = true;
  aiStatus.textContent = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function openCase(caseId) {
  setBusy(true);
  chatStatus.textContent = 'Loading diagnosis…';
  try {
    const data = await invoke({ action: 'load', caseId });
    currentCaseId = caseId;
    newCaseView.hidden = true;
    chatView.hidden = false;
    chatVehicle.textContent = `${data.vehicle?.registration || 'VEHICLE'} · ${[data.vehicle?.make,data.vehicle?.model].filter(Boolean).join(' ')}`;
    chatTitle.textContent = data.case?.title || 'AI diagnosis';
    renderMessages(data.messages || []);
    chatStatus.textContent = aiQuestions > 0 ? `${aiQuestions} AI questions available.` : 'No AI questions left. Get more from Plans & credits.';
  } catch (error) {
    aiStatus.textContent = error.message;
  } finally { setBusy(false); }
}

async function loadCases() {
  try {
    const data = await invoke({ action: 'list' });
    const cases = Array.isArray(data.cases) ? data.cases : [];
    caseList.innerHTML = cases.length ? cases.map(item => `<button class="ai-case" type="button" data-case-id="${escapeHtml(item.id)}"><strong>${escapeHtml(item.registration)}</strong><span>${escapeHtml(item.title || item.category)}</span><small>${new Date(item.updatedAt || item.createdAt).toLocaleDateString('en-GB')}</small></button>`).join('') : '<p class="ai-muted">No AI diagnoses saved yet.</p>';
    caseList.querySelectorAll('[data-case-id]').forEach(button => button.addEventListener('click', () => openCase(button.dataset.caseId)));
  } catch (error) {
    caseList.innerHTML = `<p class="ai-muted">${escapeHtml(error.message)}</p>`;
  }
}

categoryGrid.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => {
  selectedCategory = button.dataset.category;
  categoryGrid.querySelectorAll('[data-category]').forEach(item => item.classList.toggle('is-selected', item === button));
}));
categoryGrid.querySelector('[data-category="Other"]')?.classList.add('is-selected');

photoInput.addEventListener('change', async () => { try { await addFiles(photoInput.files,'new'); aiStatus.textContent=''; } catch(e){ aiStatus.textContent=e.message; } finally { photoInput.value=''; } });
chatPhotoInput.addEventListener('change', async () => { try { await addFiles(chatPhotoInput.files,'chat'); chatStatus.textContent=''; } catch(e){ chatStatus.textContent=e.message; } finally { chatPhotoInput.value=''; } });

startButton.addEventListener('click', async () => {
  const vehicleId = vehicleSelect.value;
  const text = issueText.value.trim();
  if (aiQuestions < 1) return aiStatus.innerHTML = 'You have no AI questions left. <a href="/credits.html">Get 10 questions for 4 credits or upgrade to REG+.</a>';
  if (!vehicleId) return aiStatus.textContent = 'Choose a vehicle from your Garage.';
  if (text.length < 3) return aiStatus.textContent = 'Describe what is happening with the car.';
  setBusy(true);
  aiStatus.textContent = 'BIISMO is analysing the vehicle and your description…';
  try {
    const data = await invoke({ action:'start', vehicleId, category:selectedCategory, text, images:newPhotos });
    currentCaseId = data.caseId;
    renderQuestionBalance(data.questionsRemaining);
    newCaseView.hidden = true;
    chatView.hidden = false;
    const vehicle = data.vehicle || vehicles.find(v => v.id === vehicleId) || {};
    chatVehicle.textContent = `${vehicle.registration || ''} · ${[vehicle.make,vehicle.model].filter(Boolean).join(' ')}`;
    chatTitle.textContent = text.slice(0,90);
    chatMessages.innerHTML = '';
    appendMessage('user', text);
    appendMessage('assistant', data.reply);
    issueText.value=''; newPhotos=[]; photoPreview.innerHTML='';
    chatStatus.textContent = `${aiQuestions} AI ${aiQuestions === 1 ? 'question' : 'questions'} remaining.`;
    await loadCases();
  } catch (error) { aiStatus.textContent = error.message; await loadAllowance(); }
  finally { setBusy(false); }
});

sendChatButton.addEventListener('click', async () => {
  const text = chatInput.value.trim();
  if (!currentCaseId || !text) return;
  if (aiQuestions < 1) return chatStatus.innerHTML = 'No AI questions left. <a href="/credits.html">Get more questions.</a>';
  setBusy(true);
  chatStatus.textContent = 'Analysing your follow-up…';
  try {
    const data = await invoke({ action:'message', caseId:currentCaseId, text, images:chatPhotos });
    renderQuestionBalance(data.questionsRemaining);
    appendMessage('user', text);
    appendMessage('assistant', data.reply);
    chatInput.value=''; chatPhotos=[]; chatPhotoPreview.innerHTML='';
    chatStatus.textContent = `${aiQuestions} AI ${aiQuestions === 1 ? 'question' : 'questions'} remaining.`;
    await loadCases();
  } catch (error) { chatStatus.textContent = error.message; await loadAllowance(); }
  finally { setBusy(false); }
});

newCaseButton.addEventListener('click', showNewCase);
backToNewButton.addEventListener('click', showNewCase);
refreshCasesButton.addEventListener('click', loadCases);

(async function init() {
  await window.biismoAuth.ready;
  const user = window.biismoAuth.getUser();
  if (!user) { signedOut.hidden=false; return; }

  try {
    const status = await invoke({ action:'status' });
    aiEnabled = Boolean(status.enabled);
    if (!aiEnabled) {
      unavailable.hidden=false;
      unavailableText.textContent='AI Mechanic is built and ready. Add the OpenAI API key to activate live diagnoses and photo analysis.';
      return;
    }
    workspace.hidden=false;
    await loadAllowance();
    await Promise.all([loadVehicles(),loadCases()]);
    if (aiQuestions < 1) aiStatus.innerHTML = 'You have no AI questions yet. <a href="/credits.html">Unlock 10 for 4 credits or get BIISMO REG+.</a>';
  } catch (error) {
    unavailable.hidden=false;
    unavailableText.textContent=error.message || 'AI Mechanic could not be loaded.';
  }
})();
