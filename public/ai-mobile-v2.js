(() => {
  if (window.location.pathname !== '/ai-mechanic.html') return;

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
          min-height:126px!important;
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
          min-height:126px!important;
          max-height:180px!important;
          margin:0!important;
          padding:22px 24px 58px!important;
          border:0!important;
          outline:0!important;
          background:transparent!important;
          box-shadow:none!important;
          resize:none!important;
          color:#f4f6fa!important;
          font-size:18px!important;
          line-height:1.4!important;
          text-align:left!important;
        }
        .ai-chat-compose textarea::placeholder{
          color:#9198a4!important;
          opacity:1!important;
        }
        .ai-chat-compose .ai-compose-photo{
          position:absolute!important;
          left:18px!important;
          bottom:14px!important;
          display:flex!important;
          align-items:center!important;
          justify-content:center!important;
          width:40px!important;
          min-width:40px!important;
          height:40px!important;
          min-height:40px!important;
          padding:0!important;
          border:0!important;
          border-radius:50%!important;
          background:transparent!important;
          box-shadow:none!important;
          color:#f5f7fb!important;
          font-size:34px!important;
          font-weight:300!important;
          line-height:1!important;
          z-index:3!important;
        }
        .ai-chat-compose .ai-compose-photo:active{background:rgba(255,255,255,.07)!important}
        .ai-chat-compose .ai-send-button{
          position:absolute!important;
          right:14px!important;
          bottom:12px!important;
          display:flex!important;
          align-items:center!important;
          justify-content:center!important;
          width:46px!important;
          min-width:46px!important;
          height:46px!important;
          min-height:46px!important;
          padding:0!important;
          border:0!important;
          border-radius:50%!important;
          background:linear-gradient(145deg,#38a9ff,#2867f0)!important;
          box-shadow:0 7px 18px rgba(45,123,246,.3)!important;
          color:#fff!important;
          font-size:25px!important;
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
      }
      @media(max-width:430px){
        .ai-chat-compose{min-height:116px!important;border-radius:26px!important}
        .ai-chat-compose textarea{
          min-height:116px!important;
          padding:18px 20px 55px!important;
          font-size:17px!important;
        }
        .ai-chat-compose .ai-compose-photo{left:14px!important;bottom:11px!important;width:38px!important;min-width:38px!important;height:38px!important;min-height:38px!important;font-size:31px!important}
        .ai-chat-compose .ai-send-button{right:12px!important;bottom:10px!important;width:44px!important;min-width:44px!important;height:44px!important;min-height:44px!important;font-size:24px!important}
      }
    `;
    document.head.append(style);

    const input = document.getElementById('chatInput');
    if (input) {
      input.placeholder = 'Ask Biismo AI';
      input.rows = 2;
    }
  }

  function initMobileChatShell() {
    installComposerPolish();
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
