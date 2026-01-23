// Inject "Open in VSCode" buttons next to filenames in GitHub diffs

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

// Button styles
const buttonStyle = `
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  margin-left: 8px;
  font-size: 12px;
  font-weight: 500;
  color: #0969da;
  background: transparent;
  border: 1px solid #0969da;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  vertical-align: middle;
`.replace(/\n/g, '');

const buttonHoverStyle = `
  background: #0969da;
  color: white;
`.replace(/\n/g, '');

const cursorButtonStyle = `
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  margin-left: 8px;
  font-size: 12px;
  font-weight: 500;
  color: #7c3aed;
  background: transparent;
  border: 1px solid #7c3aed;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  vertical-align: middle;
`.replace(/\n/g, '');

const cursorButtonHoverStyle = `
  background: #7c3aed;
  color: white;
`.replace(/\n/g, '');

function createEditorButton(filePath, editor = 'vscode') {
  const isCursor = editor === 'cursor';
  const button = document.createElement('button');
  button.className = isCursor ? 'open-in-cursor-btn' : 'open-in-vscode-btn';
  const style = isCursor ? cursorButtonStyle : buttonStyle;
  const hoverStyle = isCursor ? cursorButtonHoverStyle : buttonHoverStyle;
  button.setAttribute('style', style);
  
  if (isCursor) {
    button.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
        <path d="M14.5 1.5l-13 5.5 5 2 2 5 5.5-13z"/>
      </svg>
      Cursor
    `;
    button.title = 'Open this file in Cursor';
  } else {
    button.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
        <path d="M11.28 0L5.5 5.78 2.28 2.56 0 3.5v9l2.28.94L5.5 10.22 11.28 16 16 14.5v-13L11.28 0zM5.5 8.5l-2.72 2.72V4.78L5.5 7.5v1z"/>
      </svg>
      VSCode
    `;
    button.title = 'Open this file in VSCode';
  }
  
  button.addEventListener('mouseenter', () => {
    button.setAttribute('style', style + hoverStyle);
  });
  
  button.addEventListener('mouseleave', () => {
    button.setAttribute('style', style);
  });
  
  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      // Construct the full GitHub URL for this file
      const currentUrl = new URL(window.location.href);
      const pathParts = currentUrl.pathname.split('/');
      
      // Extract owner and repo from URL
      const owner = pathParts[1];
      const repo = pathParts[2];
      
      // Try to determine the ref (branch/commit)
      let ref = 'main'; // default
      let fileUrl;
      if (pathParts[3] === 'pull') {
        fileUrl = `${currentUrl.origin}/${owner}/${repo}/blob/${ref}/${filePath}`;
      } else if (pathParts[3] === 'commit') {
        const commitSha = pathParts[4];
        fileUrl = `${currentUrl.origin}/${owner}/${repo}/blob/${commitSha}/${filePath}`;
      } else if (pathParts[3] === 'compare' || pathParts[3] === 'tree' || pathParts[3] === 'blob') {
        ref = pathParts[4];
        fileUrl = `${currentUrl.origin}/${owner}/${repo}/blob/${ref}/${filePath}`;
      }
      
      if (fileUrl) {
        await sendToBackground({
          action: isCursor ? 'openInCursor' : 'openInVscode',
          url: fileUrl,
        });
      }
    } catch (error) {
      console.error(`Failed to open in ${isCursor ? 'Cursor' : 'VSCode'}:`, error);
    }
  });
  
  return button;
}

function createVSCodeButton(filePath) {
  return createEditorButton(filePath, 'vscode');
}

function createCursorButton(filePath) {
  return createEditorButton(filePath, 'cursor');
}

function injectButton(fileHeader) {
  // Check if button already exists
  if (fileHeader.querySelector('.open-in-vscode-btn')) {
    return;
  }
  
  // Try to get file path from data attribute or text content
  let filePath = fileHeader.getAttribute('data-path');
  
  if (!filePath) {
    // Try to find it in the file info element
    const fileInfo = fileHeader.querySelector('.file-info, .file-header-title, [data-path]');
    if (fileInfo) {
      filePath = fileInfo.getAttribute('data-path') || fileInfo.getAttribute('title');
      
      // If still not found, try to extract from text content
      if (!filePath) {
        const linkElement = fileInfo.querySelector('a[title], a[href*="/blob/"], .link-gray-dark');
        if (linkElement) {
          filePath = linkElement.getAttribute('title') || linkElement.textContent.trim();
        }
      }
    }
  }
  
  if (!filePath) {
    return;
  }
  
  // Create and inject the buttons
  const vscodeButton = createVSCodeButton(filePath);
  const cursorButton = createCursorButton(filePath);
  
  // Find the best place to insert the button
  const fileActions = fileHeader.querySelector('.file-actions, .file-header-actions');
  if (fileActions) {
    fileActions.prepend(cursorButton);
    fileActions.prepend(vscodeButton);
  } else {
    // Fallback: append to file info
    const fileInfo = fileHeader.querySelector('.file-info, .file-header-title');
    if (fileInfo) {
      fileInfo.appendChild(vscodeButton);
      fileInfo.appendChild(cursorButton);
    }
  }
}

function processFileHeaders() {
  // Find all file headers in diffs
  const selectors = [
    '.file-header',
    '.file-diff-header',
    '.js-file-header',
    '[data-path].file-header',
    '.file.js-details-container .file-header'
  ];
  
  const fileHeaders = document.querySelectorAll(selectors.join(', '));
  fileHeaders.forEach(injectButton);
}

// Initial injection
processFileHeaders();

// Watch for dynamically loaded content
const observer = new MutationObserver((mutations) => {
  let shouldProcess = false;
  
  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      shouldProcess = true;
      break;
    }
  }
  
  if (shouldProcess) {
    processFileHeaders();
    hijackFilePathLinks();
    injectBlobViewButton();
  }
});

// Hijack file path links to open in VSCode instead of scrolling to diff
function hijackFilePathLinks() {
  // Select file path links in PR diff file list (the links that jump to diff sections)
  const filePathLinks = document.querySelectorAll([
    'a.Link--primary[href^="#diff-"]',
    'a[href^="#diff-"] code',
    '.file-info a[href^="#"]',
    'a.link-gray-dark[href^="#diff-"]'
  ].join(', '));
  
  filePathLinks.forEach((element) => {
    // Get the actual link element (might be the <code> inside <a>)
    const link = element.tagName === 'A' ? element : element.closest('a');
    if (!link || link.hasAttribute('data-vscode-hijacked')) {
      return;
    }
    
    // Mark as hijacked
    link.setAttribute('data-vscode-hijacked', 'true');
    
    // Extract file path from text content
    let filePath = link.textContent.trim();
    // Remove invisible characters
    filePath = filePath.replace(/[\u200B-\u200F\uFEFF]/g, '');
    
    // Store original href for fallback
    const originalHref = link.getAttribute('href');
    
    // Change cursor and add visual indicator
    link.style.cursor = 'pointer';
    link.title = `Open ${filePath} in VSCode (Ctrl/Cmd+Click for original behavior)`;
    
    link.addEventListener('click', async (e) => {
      // Allow Ctrl/Cmd+Click to use original behavior
      if (e.metaKey || e.ctrlKey) {
        return;
      }
      
      e.preventDefault();
      e.stopPropagation();
      
      try {
        const currentUrl = new URL(window.location.href);
        const pathParts = currentUrl.pathname.split('/');
        const owner = pathParts[1];
        const repo = pathParts[2];
        
        // For PRs, construct a blob URL
        let ref = 'main';
        if (pathParts[3] === 'pull') {
          // Try to get the head branch - default to main
          ref = 'main';
        } else if (pathParts[4]) {
          ref = pathParts[4];
        }
        
        const fileUrl = `${currentUrl.origin}/${owner}/${repo}/blob/${ref}/${filePath}`;
        
        await sendToBackground({
          action: 'openInVscode',
          url: fileUrl,
        });
      } catch (error) {
        console.error('Failed to open in VSCode:', error);
        // Fallback to original behavior
        if (originalHref) {
          window.location.hash = originalHref;
        }
      }
    });
  });
}

// Initial processing
hijackFilePathLinks();
injectBlobViewButton();

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Add button to blob (file viewer) page
function injectBlobViewButton() {
  // Only run on blob pages
  if (!window.location.pathname.includes('/blob/')) {
    return;
  }
  
  // Check if already injected
  if (document.querySelector('.open-in-vscode-blob-btn')) {
    return;
  }
  
  // Find the file info element that shows lines/size info (e.g., "635 lines (551 loc) · 27.1 KB")
  const fileInfoSelectors = [
    // New GitHub UI - text showing lines and size
    '.react-code-size-details-in-header',
    '[class*="text-mono"][class*="f6"]',
    '.file-info .text-mono',
    // Look for elements containing "lines" or "loc" text
    '.Box-header .text-mono',
  ];
  
  let fileInfoElement = null;
  for (const selector of fileInfoSelectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      if (el.textContent && (el.textContent.includes('lines') || el.textContent.includes('loc') || el.textContent.includes('KB') || el.textContent.includes('MB'))) {
        fileInfoElement = el;
        break;
      }
    }
    if (fileInfoElement) break;
  }
  
  if (!fileInfoElement) {
    // Fallback: find any element with file size info
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      if (el.children.length === 0 && el.textContent && /\d+\s*(lines|loc|KB|MB|Bytes)/i.test(el.textContent)) {
        fileInfoElement = el;
        break;
      }
    }
  }
  
  if (!fileInfoElement) {
    return;
  }
  
  // Create VSCode button
  const vscodeButton = document.createElement('button');
  vscodeButton.className = 'open-in-vscode-blob-btn';
  vscodeButton.setAttribute('style', buttonStyle);
  vscodeButton.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M11.28 0L5.5 5.78 2.28 2.56 0 3.5v9l2.28.94L5.5 10.22 11.28 16 16 14.5v-13L11.28 0zM5.5 8.5l-2.72 2.72V4.78L5.5 7.5v1z"/>
    </svg>
    VSCode
  `;
  vscodeButton.title = 'Open this file in VSCode';
  
  vscodeButton.addEventListener('mouseenter', () => {
    vscodeButton.setAttribute('style', buttonStyle + buttonHoverStyle);
  });
  
  vscodeButton.addEventListener('mouseleave', () => {
    vscodeButton.setAttribute('style', buttonStyle);
  });
  
  vscodeButton.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      await sendToBackground({
        action: 'openInVscode',
        url: window.location.href,
      });
    } catch (error) {
      console.error('Failed to open in VSCode:', error);
      alert('Failed to open in VSCode: ' + error.message);
    }
  });
  
  // Create Cursor button
  const cursorButton = document.createElement('button');
  cursorButton.className = 'open-in-cursor-blob-btn';
  cursorButton.setAttribute('style', cursorButtonStyle);
  cursorButton.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M14.5 1.5l-13 5.5 5 2 2 5 5.5-13z"/>
    </svg>
    Cursor
  `;
  cursorButton.title = 'Open this file in Cursor';
  
  cursorButton.addEventListener('mouseenter', () => {
    cursorButton.setAttribute('style', cursorButtonStyle + cursorButtonHoverStyle);
  });
  
  cursorButton.addEventListener('mouseleave', () => {
    cursorButton.setAttribute('style', cursorButtonStyle);
  });
  
  cursorButton.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      await sendToBackground({
        action: 'openInCursor',
        url: window.location.href,
      });
    } catch (error) {
      console.error('Failed to open in Cursor:', error);
      alert('Failed to open in Cursor: ' + error.message);
    }
  });
  
  // Insert the buttons right after the file info element (lines/size info)
  fileInfoElement.parentNode.insertBefore(cursorButton, fileInfoElement.nextSibling);
  fileInfoElement.parentNode.insertBefore(vscodeButton, fileInfoElement.nextSibling);
}
