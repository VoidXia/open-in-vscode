// Keyboard shortcut handler for github.com
// Listens for cmd+dot to open current page in VSCode (only on blob/file viewing pages)

// Helper function to send message to background script (with wake-up)
async function sendToBackground(message) {
  // This ping helps wake up the service worker if it's dormant
  try {
    await chrome.runtime.sendMessage({ action: 'ping' });
  } catch (e) {
    // Ignore ping errors
  }
  return chrome.runtime.sendMessage(message);
}

document.addEventListener('keydown', async (event) => {
  // Check for cmd+dot (Mac) or ctrl+dot (Windows/Linux)
  const modifierKey = event.metaKey || event.ctrlKey;
  const isDotKey = event.key === '.';

  if (modifierKey && isDotKey) {
    // Only work on blob (file viewing) pages
    const currentPath = window.location.pathname;
    if (!currentPath.includes('/blob/')) {
      return;
    }
    
    event.preventDefault();
    
    // Send message to background script to open in VSCode
    try {
      await sendToBackground({
        action: 'openInVscode',
        url: window.location.href,
      });
    } catch (error) {
      console.error('Failed to open in VSCode:', error);
    }
  }
});
