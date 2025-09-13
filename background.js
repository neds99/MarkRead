// When the user clicks the action icon, send a message to the content script.
chrome.action.onClicked.addListener((tab) => {
  // The content script is injected via the manifest, so we just send a message.
  if (tab.id && tab.url?.startsWith('http')) {
    chrome.tabs.sendMessage(tab.id, { action: "markAllLinks" });
  }
});

// Listen for messages from other parts of the extension.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "saveUrls" && Array.isArray(message.urls) && message.urls.length > 0) {
    handleSaveUrls(message.urls).then(() => sendResponse({ status: "save_complete" }));
    return true;
  }
  if (message.action === "runPruning") {
    console.log('MarkRead: Pruning triggered from options page.');
    pruneOldLinks().then(() => sendResponse({ status: "pruning_complete" }));
    return true; // Required for async sendResponse.
  }
  if (message.action === "updateColor") {
    // Forward the color update message to all relevant tabs
    broadcastColorUpdate(message.color);
    sendResponse({ status: "color_update_broadcasted" });
  }
});

async function handleSaveUrls(urls) {
  // Create an object where keys are the URLs and the value is the current timestamp.
  const urlsToSave = {};
  const timestamp = Date.now();
  urls.forEach(url => {
    urlsToSave[url] = timestamp;
  });

  // Save the new URLs. This is an append-only operation.
  await chrome.storage.local.set(urlsToSave);
}

// --- Pruning Logic ---

function onStartupOrInstall() {
  console.log('MarkRead: Running startup/install link pruning.');
  pruneOldLinks();
}

// Run pruning on browser startup and on extension installation/update.
chrome.runtime.onStartup.addListener(onStartupOrInstall);
chrome.runtime.onInstalled.addListener(onStartupOrInstall);

async function pruneOldLinks() {
  // Get prune settings, default to 60 days.
  const { pruneAfterDays = 60 } = await chrome.storage.local.get('pruneAfterDays');

  if (pruneAfterDays <= 0) {
    console.log('MarkRead: Pruning is disabled (pruneAfterDays <= 0).');
    return;
  }

  const allItems = await chrome.storage.local.get(null);
  const urlsToRemove = [];
  const cutoff = Date.now() - (pruneAfterDays * 24 * 60 * 60 * 1000);

  for (const [key, value] of Object.entries(allItems)) {
    // Heuristic to identify a URL entry: key starts with http and value is a number (timestamp).
    if (key.startsWith('http') && typeof value === 'number' && value < cutoff) {
      urlsToRemove.push(key);
    }
  }

  if (urlsToRemove.length > 0) {
    await chrome.storage.local.remove(urlsToRemove);
    console.log(`MarkRead: Pruned ${urlsToRemove.length} old links.`);
  }
}

async function broadcastColorUpdate(color) {
  // Find all tabs where the content script might be running
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });

  for (const tab of tabs) {
    try {
      // Send a message to the content script in each tab
      await chrome.tabs.sendMessage(tab.id, {
        action: "updateStyle",
        color: color
      });
    } catch (error) {
      // This can happen if the content script is not injected on a page (e.g., if the tab is not ready). We can safely ignore these errors.
    }
  }
}
