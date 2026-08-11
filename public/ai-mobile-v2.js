(() => {
  if (window.location.pathname !== '/ai-mechanic.html') return;

  const isMobile = () => window.matchMedia('(max-width: 850px)').matches;

  function installComposerPolish() {
    if (document.getElementById('biismoComposerReferenceStyle')) return;
    const style = document.createElement('style');
    style.id = 'biismoComposerReferenceStyle';
    style.textContent = `
      @media(max-width:850px){
        .ai-chat-compose-wrap{
          padding:10px max(10px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left))!important;
        }
        .ai-chat-compose{
          position:relative!important;
          display:block!important;
          width:100%!important;
          max-width:700px!important;
          min-height:116px!important;
          margin:0 auto!important;
          padding:0!important;
          border:1px solid rgba(255,255,255,.14)!important;
          border-radius:28px!important;
          background:#11151b!important;
          box-shadow:0 12px 34px rgba(0,0,0,.28)!important;
          overflow:hidden!important;
        }
        .ai-chat-compose textarea{
          display:block!important;
          position:relative!important;
          width:100%!important;
          min-height:116px!important;
          max-height:180px!important;
          margin:0!important;
          padding:18px 20px 55px!important;
          border:0!important;
          outline:0!important;
          background:transparent!important;
          box-shadow:none!important;
          resize:none!important;
          color:#f4f6fa!important;
          font-size:17px!important;
          line-height:1.4!important;
          text-align:left!important;
        }
        .ai-chat-compose textarea::placeholder{
          color:#9198a4!important;
          opacity:1!important;
        }
        .ai-chat-compose .ai-compose-photo{
          position:absolute!important;
          left:14px!important;
          bottom:11px!important;
          display:flex!important;
          align-items:center!important;
          justify-content:center!important;
          width:38px!important;
          min-width:38px!important;
          height:38px!important;
          min-height:38px!important;
          padding:0!important;
          border:0!important;
          border-radius:50%!important;
          background:transparent!important;
          box-shadow:none!important;
          color:#f5f7fb!important;
          font-size:31px!important;
          font-weight:300!important;
          line-height:1!important;
          z-index:3!important;
        }
        .ai-chat-compose .ai-compose-photo:active{background:rgba(255,255,255,.07)!important}
        .ai-chat-compose .ai-send-button{
          position:absolute!important;
          right:12px!important;
          bottom:10px!important;
          display:flex!important;
          align-items:center!important;
          justify-content:center!important;
          width:44px!important;
          min-width:44px!important;
          height:44px!important;
          min-height:44px!important;
          padding:0!important;
          border:0!important;
          border-radius:50%!important;
          background:linear-gradient(145deg,#38a9ff,#2867f0)!important;
          box-shadow:0 7px 18px rgba(45,123,246,.3)!important;
          color:#fff!important;
          font-size:24px!important;
          font-weight:600!important;
          line-height:1!important;
          z-index:3!important;
        }
        .ai-chat-compose .ai-send-button:active:not(:disabled){transform:scale(.95)}
        .ai-chat-compose .ai-send-button:disabled{
          opacity:.42!important;
          box-shadow:none!important;
        }
        .ai-chat-compose-wrap>.ai-status{
          margin:6px auto 0!important;
          padding:0 8px!important;
          font-size:10px!important;
          color:#858e9d!important;
          text-align:center!important;
        }

        /* Attachments now live inside the composer and reserve their own space. */
        .ai-chat-compose>#chatPhotoPreview{
          position:relative!important;
          left:auto!important;
          right:auto!important;
          bottom:auto!important;
          z-index:2!important;
          display:flex!important;
          width:auto!important;
          max-width:none!important;
          min-height:0!important;
          margin:0!important;
          padding:12px 14px 0!important;
          gap:8px!important;
          overflow-x:auto!important;
          background:transparent!important;
          -webkit-overflow-scrolling:touch;
        }
        .ai-chat-compose>#chatPhotoPreview[hidden]{display:none!important}
        .ai-chat-compose>#chatPhotoPreview:not([hidden]) + textarea{
          min-height:94px!important;
          padding-top:12px!important;
        }
        .ai-chat-compose>#chatPhotoPreview .ai-photo-chip-confirmed{
          flex:0 0 68px!important;
          width:68px!important;
          height:68px!important;
          margin:0!important;
        }

        /* A new chat uses the same conversation shell as previous chats. */
        body.ai-mobile-new-chat .ai-chat-top{display:flex!important}
        body.ai-mobile-new-chat .ai-chat-messages{min-height:calc(100dvh - 285px)!important}
        .ai-mobile-draft-vehicle{
          display:none;
          width:100%;
          max-width:360px;
          min-height:38px;
          margin:8px 0 0;
          padding:0 36px 0 11px;
          border:1px solid rgba(255,255,255,.13);
          border-radius:12px;
          background:#10151d;
          color:#f3f5f8;
          font:inherit;
          font-size:12px;
        }
        body.ai-mobile-new-chat .ai-mobile-draft-vehicle{display:block}
        body.ai-mobile-new-chat #chatMessages:empty::before{
          content:'Ask about a warning light, noise, fault, tyre, leak or anything else with your car.';
          display:block;
          max-width:560px;
          margin:22px 0;
          color:#a7afbb;
          font-size:15px;
          line-height:1.55;
        }
      }
    `;
    document.head.append(style);

    const input = document.getElementById('chatInput');
    if (input) {
      input.placeholder = 'Ask Biismo AI';
      input.rows = 2;
    }

    const compose = document.querySelector('.ai-chat-compose');
    const preview = document.getElementById('chatPhotoPreview');
    const textarea = document.getElementById('chatInput');
    if (compose && preview && textarea && preview.parentElement !== compose) {
      compose.insertBefore(preview, textarea);
    }
  }

  function installMobileNewChat() {
    const newCaseView = document.getElementById('newCaseView');
    const chatView = document.getElementById('chatView');
    const chatMessages = document.getElementById('chatMessages');
    const chatTitle = document.getElementById('chatTitle');
    const chatVehicle = document.getElementById('chatVehicle');
    const chatInput = document.getElementById('chatInput');
    const send = document.getElementById('sendChatButton');
    const chatStatus = document.getElementById('chatStatus');
    const vehicleSelect = document.getElementById('vehicleSelect');
    const issueText = document.getElementById('issueText');
    const newCase = document.getElementById('newCaseButton');
    const backToNew = document.getElementById('backToNewButton');
    const caseList = document.getElementById('caseList');
    const workspace = document.getElementById('aiWorkspace');
    const chatTop = document.querySelector('.ai-chat-top > div');
    if (!newCaseView || !chatView || !chatMessages || !chatInput || !send || !vehicleSelect || !issueText || !chatTop) return;

    let mobileVehicle = document.getElementById('mobileDraftVehicleSelect');
    if (!mobileVehicle) {
      mobileVehicle = document.createElement('select');
      mobileVehicle.id = 'mobileDraftVehicleSelect';
      mobileVehicle.className = 'ai-mobile-draft-vehicle';
      mobileVehicle.setAttribute('aria-label', 'Vehicle for this new chat');
      chatTop.append(mobileVehicle);
    }

    const syncVehicles = () => {
      const oldValue = mobileVehicle.value;
      mobileVehicle.innerHTML = vehicleSelect.innerHTML;
      if (oldValue && [...mobileVehicle.options].some(option => option.value === oldValue)) mobileVehicle.value = oldValue;
      else if (vehicleSelect.value) mobileVehicle.value = vehicleSelect.value;
      else {
        const firstVehicle = [...mobileVehicle.options].find(option => option.value);
        if (firstVehicle) mobileVehicle.value = firstVehicle.value;
      }
    };
    syncVehicles();
    new MutationObserver(syncVehicles).observe(vehicleSelect, { childList:true, subtree:true });

    const enterDraft = () => {
      if (!isMobile()) return;
      currentCaseId = null;
      document.body.classList.add('ai-mobile-new-chat');
      newCaseView.hidden = true;
      chatView.hidden = false;
      chatMessages.innerHTML = '';
      chatTitle.textContent = 'New chat';
      chatVehicle.textContent = 'BIISMO AI';
      chatStatus.textContent = aiQuestions > 0 ? `${aiQuestions} AI ${aiQuestions === 1 ? 'question' : 'questions'} available.` : 'No AI questions left.';
      syncVehicles();
      chatInput.value = '';
      chatInput.style.height = '';
      window.scrollTo({ top:0, behavior:'smooth' });
    };

    const exitDraft = () => document.body.classList.remove('ai-mobile-new-chat');

    const startDraft = async () => {
      if (!isMobile() || !document.body.classList.contains('ai-mobile-new-chat') || currentCaseId) return;
      const text = chatInput.value.trim();
      if (!text && !chatPhotos.length) return;
      vehicleSelect.value = mobileVehicle.value;
      issueText.value = text;
      newPhotos = [...chatPhotos];
      chatStatus.textContent = 'Biismo AI is thinking…';
      await startDiagnosis();
      if (currentCaseId) {
        exitDraft();
        chatInput.value = '';
        chatInput.style.height = '';
        chatPhotos = [];
        renderPhotos(document.getElementById('chatPhotoPreview'), chatPhotos, 'chat');
      } else {
        chatStatus.innerHTML = aiStatus.innerHTML || aiStatus.textContent || 'Could not start this chat.';
      }
    };

    newCase?.addEventListener('click', () => setTimeout(enterDraft, 0));
    backToNew?.addEventListener('click', () => setTimeout(enterDraft, 0));
    caseList?.addEventListener('click', event => {
      if (event.target.closest('[data-case-id]')) exitDraft();
    }, true);

    send.addEventListener('click', () => {
      if (document.body.classList.contains('ai-mobile-new-chat') && !currentCaseId) void startDraft();
    });
    chatInput.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && document.body.classList.contains('ai-mobile-new-chat') && !currentCaseId) {
        event.preventDefault();
        void startDraft();
      }
    });

    const syncInitialView = () => {
      if (isMobile() && workspace && !workspace.hidden && !currentCaseId && !document.body.classList.contains('ai-mobile-new-chat')) enterDraft();
    };
    syncInitialView();
    if (workspace) new MutationObserver(syncInitialView).observe(workspace, { attributes:true, attributeFilter:['hidden'] });

    window.matchMedia('(max-width: 850px)').addEventListener?.('change', event => {
      if (event.matches && !currentCaseId) enterDraft();
      if (!event.matches && document.body.classList.contains('ai-mobile-new-chat')) {
        exitDraft();
        chatView.hidden = true;
        newCaseView.hidden = false;
      }
    });
  }

  function initMobileChatShell() {
    installComposerPolish();
    installMobileNewChat();
    const header = document.querySelector('.ai-header');
    const sidebar = document.querySelector('.ai-sidebar');
    const caseList = document.getElementById('caseList');
    const newCase = document.getElementById('newCaseButton');
    const chatView = document.getElementById('chatView');
    if (!header || !sidebar) return;

    let chatsButton = document.getElementById('mobileChatsButton');
    if (!chatsButton) {
      chatsButton = document.createElement('button');
      chatsButton.id = 'mobileChatsButton';
      chatsButton.className = 'ai-mobile-chats-button';
      chatsButton.type = 'button';
      chatsButton.setAttribute('aria-label', 'Open previous chats');
      chatsButton.setAttribute('aria-expanded', 'false');
      chatsButton.innerHTML = '<span aria-hidden="true">☰</span><span>Chats</span>';
      const actions = header.querySelector('.ai-header-actions');
      header.insertBefore(chatsButton, actions || null);
    }

    let closeButton = document.getElementById('mobileDrawerClose');
    if (!closeButton) {
      closeButton = document.createElement('button');
      closeButton.id = 'mobileDrawerClose';
      closeButton.className = 'ai-mobile-drawer-close';
      closeButton.type = 'button';
      closeButton.setAttribute('aria-label', 'Close chats');
      closeButton.textContent = '×';
      sidebar.append(closeButton);
    }

    let backdrop = document.getElementById('mobileDrawerBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'mobileDrawerBackdrop';
      backdrop.className = 'ai-mobile-drawer-backdrop';
      document.body.append(backdrop);
    }

    const openDrawer = () => {
      document.body.classList.add('ai-chat-drawer-open');
      chatsButton.setAttribute('aria-expanded', 'true');
    };
    const closeDrawer = () => {
      document.body.classList.remove('ai-chat-drawer-open');
      chatsButton.setAttribute('aria-expanded', 'false');
    };

    chatsButton.addEventListener('click', () => {
      document.body.classList.contains('ai-chat-drawer-open') ? closeDrawer() : openDrawer();
    });
    closeButton.addEventListener('click', closeDrawer);
    backdrop.addEventListener('click', closeDrawer);
    newCase?.addEventListener('click', closeDrawer);

    caseList?.addEventListener('click', (event) => {
      if (!event.target.closest('[data-case-id]')) return;
      closeDrawer();
      window.setTimeout(() => {
        document.getElementById('chatView')?.scrollIntoView({ block: 'start' });
      }, 180);
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeDrawer();
    });

    const syncChatState = () => {
      document.body.classList.toggle('ai-chat-active', Boolean(chatView && !chatView.hidden));
    };
    syncChatState();
    if (chatView) new MutationObserver(syncChatState).observe(chatView, { attributes: true, attributeFilter: ['hidden'] });

    const media = window.matchMedia('(min-width: 851px)');
    const clearDesktopDrawer = () => { if (media.matches) closeDrawer(); };
    media.addEventListener?.('change', clearDesktopDrawer);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMobileChatShell, { once: true });
  else initMobileChatShell();
})();
