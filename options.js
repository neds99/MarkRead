/**
 * Handles the logic for the extension's options page.
 * - Displays storage statistics.
 * - Allows users to configure data pruning.
 * - Allows users to clear all stored data.
 */

/**
 * Displays a status message in the #status element.
 * @param {string} message The message to display.
 * @param {boolean} isError If true, displays the message in red.
 */
function showStatus(message, isError = false) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#d9534f' : '#28a745';

  setTimeout(() => {
    statusEl.textContent = '';
  }, 3000);
}

/**
 * Loads and displays database statistics.
 */
async function loadStats() {
  const statsEl = document.getElementById('stats');
  statsEl.textContent = 'Loading...';
  try {
    const items = await chrome.storage.local.get(null);
    const bytesInUse = await chrome.storage.local.getBytesInUse(null);

    // Filter out non-URL keys (like settings) from the count.
    const linkCount = Object.keys(items).filter(key => key.startsWith('http')).length;
    const sizeMB = (bytesInUse / (1024 * 1024)).toFixed(3);

    statsEl.innerHTML = `Total links stored: <strong>${linkCount}</strong><br>
                         Database size: <strong>~${sizeMB} MB</strong>`;
  } catch (error) {
    statsEl.textContent = 'Could not load statistics.';
    console.error('Error loading stats:', error);
  }
}

/**
 * Saves the pruning settings to chrome.storage.local.
 */
async function saveSettings() {
  const pruneDaysInput = document.getElementById('pruneAfterDays');
  const linkColorInput = document.getElementById('linkColor');

  const days = parseInt(pruneDaysInput.value, 10);
  const color = linkColorInput.value;

  if (isNaN(days) || days < 0) {
    showStatus('Please enter a valid number of days (0 or more).', true);
    return;
  }

  try {
    await chrome.storage.local.set({ pruneAfterDays: days, linkColor: color });

    // Notify background script to update color in active tabs
    await chrome.runtime.sendMessage({ action: "updateColor", color: color });
    showStatus('Settings saved. Triggering prune...');

    // Tell the background script to run the pruning process now.
    await chrome.runtime.sendMessage({ action: "runPruning" });
    showStatus('Settings saved and pruning complete.');
    await loadStats(); // Refresh stats to show the result of the prune.
  } catch (error) {
    showStatus('Error saving settings.', true);
    console.error('Error saving settings:', error);
  }
}

/**
 * Loads pruning settings and populates the input field.
 */
async function loadSettings() {
  try {
    const defaults = {
      pruneAfterDays: 60,
      linkColor: '#D3D3D3' // Default color
    };
    const { pruneAfterDays, linkColor } = await chrome.storage.local.get(defaults);
    document.getElementById('pruneAfterDays').value = pruneAfterDays;
    document.getElementById('linkColor').value = linkColor;
  } catch (error) {
    showStatus('Error loading settings.', true);
    console.error('Error loading settings:', error);
  }
}

/**
 * Handles the click event for the "Clear Data" button.
 */
async function handleClearData() {
  if (!confirm('Are you sure you want to delete all saved link data? This cannot be undone.')) {
    return;
  }
  try {
    // Use the chrome.storage.local.clear API to remove all items.
    await chrome.storage.local.clear();
    showStatus('All data cleared successfully.');
    console.log('Mark Read storage cleared.');
    // Refresh stats and settings on the page.
    await Promise.all([loadStats(), loadSettings()]);
  } catch (error) {
    const message = `Error clearing data: ${error.message}`;
    showStatus(message, true);
    console.error(message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadSettings();
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('clearData').addEventListener('click', handleClearData);
}); 