chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "CARTPARTY_CAPTURE") return;
  const images = Array.from(document.images)
    .filter((image) => image.naturalWidth >= 300 && image.naturalHeight >= 200)
    .sort((a, b) => b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight);
  sendResponse({
    title: document.title,
    productUrl: location.href,
    imageUrl: images[0]?.src ?? null,
    storeName: location.hostname.replace(/^www\./, "")
  });
});
