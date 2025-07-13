function collectAndSendLinks() {
  const links = document.querySelectorAll('a[href]'); 
  const urls = [];

  links.forEach(link => {
    try {
      const absoluteUrl = link.href;

      if (absoluteUrl && (absoluteUrl.startsWith('http://') || absoluteUrl.startsWith('https://'))) {
        urls.push(absoluteUrl);
      }
    } catch (e) {
    }
  });

  chrome.runtime.sendMessage({ action: "addLinksToHistory", urls: urls });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "collectAndSendLinks") {
    collectAndSendLinks();
    sendResponse({ status: "links_sent" });
    return true; 
  }
});
