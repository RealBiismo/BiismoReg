(() => {
  if (window.location.pathname !== '/ai-mechanic.html') return;

  function initMobileChatShell() {
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
