(() => {
  if (window.location.pathname !== '/ai-mechanic.html') return;

  function ensureStyles() {
    if (document.querySelector('link[href="/ai-chat-history.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/ai-chat-history.css';
    document.head.append(link);
  }

  function ensureDeleteButton() {
    const top = document.querySelector('.ai-chat-top');
    if (!top || document.getElementById('removeAiChatButton')) return;
    const controls = document.createElement('div');
    controls.className = 'ai-chat-top-actions';

    const newCase = document.getElementById('backToNewButton');
    if (newCase) controls.append(newCase);

    const remove = document.createElement('button');
    remove.id = 'removeAiChatButton';
    remove.className = 'ai-remove-chat-button';
    remove.type = 'button';
    remove.textContent = 'Remove chat';
    controls.append(remove);
    top.append(controls);

    remove.addEventListener('click', async () => {
      if (!currentCaseId) return;
      const confirmed = window.confirm('Remove this Biismo AI chat from your history?');
      if (!confirmed) return;
      remove.disabled = true;
      const original = remove.textContent;
      remove.textContent = 'Removing…';
      try {
        await window.biismoAuth.ready;
        const client = window.biismoAuth.getClient();
        const { error } = await client.rpc('delete_my_ai_mechanic_case', { p_case_id: currentCaseId });
        if (error) throw new Error(error.message || 'Chat could not be removed.');
        chatStatus.textContent = 'Chat removed from your history.';
        showNewCase();
        await loadCases();
      } catch (error) {
        chatStatus.textContent = error.message || 'Chat could not be removed.';
      } finally {
        remove.disabled = false;
        remove.textContent = original;
      }
    });
  }

  function addHistoryHint() {
    const heading = document.querySelector('.ai-sidebar-heading');
    if (!heading || document.getElementById('aiHistoryPersistenceHint')) return;
    const hint = document.createElement('p');
    hint.id = 'aiHistoryPersistenceHint';
    hint.className = 'ai-history-persistence-hint';
    hint.textContent = 'Chats stay saved until you remove them.';
    heading.after(hint);
  }

  function tidyMessageLabels() {
    const assistantMessages = [...document.querySelectorAll('.ai-message.is-assistant')];
    assistantMessages.forEach((message, index) => {
      const label = message.querySelector('small');
      if (!label) return;
      if (index === 0) {
        label.hidden = false;
        label.textContent = 'Biismo AI';
      } else {
        label.hidden = true;
      }
    });
  }

  function init() {
    ensureStyles();
    ensureDeleteButton();
    addHistoryHint();
    tidyMessageLabels();
    const messages = document.getElementById('chatMessages');
    if (messages) new MutationObserver(tidyMessageLabels).observe(messages, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
