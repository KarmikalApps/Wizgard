// Ollama's show response records the content-addressed source blob in FROM.
export function matchesModel(show, sha256) {
  if (!/^[0-9a-f]{64}$/.test(sha256 || '')) return false;
  return (show?.modelfile || '').split(/\r?\n/).some(line =>
    /^FROM\s/i.test(line) && line.includes('sha256-' + sha256));
}
