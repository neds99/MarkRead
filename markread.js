/**
 * This content script runs on page load and handles styling links.
 * 1. Injects a dynamic stylesheet with the user-defined color for "marked as read" links.
 * 2. On load, it checks which links on the page have been previously marked and styles them.
 * 3. Listens for messages to mark all links or to update the stylesheet color.
 */

const STYLE_ID = 'markread-dynamic-style';
const DEFAULT_COLOR = '#D3D3D3';

/**
 * Injects or updates a <style> tag in the document's head with the specified color.
 * @param {string} color - The CSS color to apply to marked links.
 */
function injectOrUpdateStyle(color) {
  let styleElement = document.getElementById(STYLE_ID);
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = STYLE_ID;
    document.head.appendChild(styleElement);
  }
  // Combine the extension's link styling with your custom style.
  const markReadStyle = `a.markread--visited { color: ${color} !important; }`;
  const globalCustomStyles = `.vvp-body { max-width: 18000px; margin: 0 auto; }`;

  let siteSpecificStyles = '';
  // Conditionally add styles for Amazon Vine pages
  if (window.location.href.startsWith('https://www.amazon.com/vine')) {
    siteSpecificStyles = `
      a:visited { color: lightgray; }
      a:link {
        font-size: 14px;
        font-weight: bold;
        color: red;
      }
    `;
  }

  // Combine all styles
  styleElement.textContent = `
    ${markReadStyle}
    ${globalCustomStyles}
    ${siteSpecificStyles}
  `;
}

/**
 * Marks all links on the current page as visited.
 */
function markAllLinksAsVisited() {
  const links = document.querySelectorAll('a[href]');
  const urlsToMark = [];

  links.forEach(link => {
    link.classList.add('markread--visited');
    if (link.href && link.href.startsWith('http')) {
      urlsToMark.push(link.href);
    }
  });

  if (urlsToMark.length > 0) {
    const uniqueUrls = [...new Set(urlsToMark)];
    chrome.runtime.sendMessage({ action: "saveUrls", urls: uniqueUrls });
  }
}

/**
 * Applies the 'markread--visited' class to links that are already in storage.
 */
async function applyStoredStyles() {
  const linksOnPage = Array.from(document.querySelectorAll('a[href]'));
  const urlsOnPage = [...new Set(
    linksOnPage
      .map(link => link.href)
      .filter(href => href && href.startsWith('http'))
  )];

  if (urlsOnPage.length === 0) {
    return;
  }

  try {
    const storedUrls = await chrome.storage.local.get(urlsOnPage);
    if (Object.keys(storedUrls).length > 0) {
      linksOnPage.forEach(link => {
        if (storedUrls[link.href]) {
          link.classList.add('markread--visited');
        }
      });
    }
  } catch (error) {
    console.error('MarkRead: Error applying stored styles.', error);
  }
}

/**
 * Main initialization function.
 */
async function initialize() {
  // 1. Get the saved color and inject the stylesheet.
  const { linkColor = DEFAULT_COLOR } = await chrome.storage.local.get('linkColor');
  injectOrUpdateStyle(linkColor);

  // 2. Apply styles to links already marked as read.
  await applyStoredStyles();
}

// Listen for messages from the background script or options page.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "markAllLinks") {
    markAllLinksAsVisited();
    sendResponse({ status: "marking_initiated" });
  } else if (message.action === "updateStyle") {
    injectOrUpdateStyle(message.color);
    sendResponse({ status: "style_updated" });
  }
});

// Run the initialization logic.
initialize();