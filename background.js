// Enable side panel to open on action toolbar icon click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Error setting side panel behavior:', error));

chrome.runtime.onInstalled.addListener(() => {
  console.log('UI Detective AI Extension Installed');
});
