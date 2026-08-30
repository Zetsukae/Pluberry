function getSourcePayload(entry) {
  if (!entry) return {};
  if (typeof entry.data === "string") return { data: entry.data };
  return entry.data && typeof entry.data === "object" ? entry.data : {};
}

function getSourceUrl(entry) {
  const payload = getSourcePayload(entry);
  return payload.sourceUrl || payload.data || payload.url || "";
}

function getSourceTimestamp(entry) {
  const payload = getSourcePayload(entry);
  const timestamp = payload.timestamp || entry?.updated_at || entry?.inserted_at;
  const value = timestamp ? Date.parse(timestamp) : 0;
  return Number.isNaN(value) ? 0 : value;
}

function getLatestSource(entries = []) {
  return entries
    .filter(entry => getSourceUrl(entry))
    .sort((first, second) => {
      const firstCurrent = getSourcePayload(first).isCurrent ? 1 : 0;
      const secondCurrent = getSourcePayload(second).isCurrent ? 1 : 0;
      return getSourceTimestamp(second) - getSourceTimestamp(first) || secondCurrent - firstCurrent;
    })[0] || null;
}

function mergeSourceUrls(localUrls = [], entries = []) {
  const urls = Array.isArray(localUrls) ? [...localUrls] : [];
  for (const entry of entries) {
    const sourceUrl = getSourceUrl(entry);
    if (sourceUrl && !urls.includes(sourceUrl)) urls.push(sourceUrl);
  }
  return urls;
}

module.exports = { getLatestSource, getSourceUrl, mergeSourceUrls };