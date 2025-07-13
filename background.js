chrome.action.onClicked.addListener((tab) => {
  if (tab.id && (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://')))) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['markread.js']
    }, () => {
      chrome.tabs.sendMessage(tab.id, { action: "collectAndSendLinks" });
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "addLinksToHistory" && message.urls && Array.isArray(message.urls)) {
    const urlsToProcess = message.urls;

    urlsToProcess.forEach(url => {
      try {
        new URL(url); 
        chrome.history.addUrl({ url: url });
      } catch (e) {
      }
    });
    sendResponse({ status: "processing_initiated" });
    return true; 
  }
});
