export function validateRequest(body) {
  const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
  if (!body || typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 16000) fail('Enter a message between 1 and 16,000 characters.');
  if (!['auto', 'chat', 'image'].includes(body.mode)) fail('Choose Auto, Chat, or Image mode.');
  if (body.conversationId && !/^[0-9a-f-]{36}$/.test(body.conversationId)) fail('Invalid conversation ID.');
  const options = body.settings || {};
  const settings = { width: options.width ?? 1024, height: options.height ?? 1024, steps: options.steps ?? 25, seed: options.seed ?? -1,
    backend: options.backend ?? 'auto', thinking: options.thinking === true };
  for (const key of ['width', 'height']) if (!Number.isInteger(settings[key]) || settings[key] < 256 || settings[key] > 2048 || settings[key] % 32) fail('Image dimensions must be multiples of 32 between 256 and 2048.');
  if (!Number.isInteger(settings.steps) || settings.steps < 1 || settings.steps > 60) fail('Choose 1–60 image steps.');
  if (!Number.isSafeInteger(settings.seed) || settings.seed < -1 || settings.seed > 2147483647) fail('Seed must be -1 (random) or an integer up to 2147483647.');
  if (!['auto', 'cuda', 'cpu', 'vulkan', 'metal'].includes(settings.backend)) fail('Choose an available image runtime.');
  return { prompt: body.prompt.trim(), mode: body.mode, conversationId: body.conversationId || null, settings };
}
export function routeFallback(text) {
  if (/\b(?:do not|don't|never|without)\s+(?:create|generate|draw|render)\b/i.test(text)) return 'chat';
  if (/\b(?:code|script|tutorial|how (?:do|can|to)|explain)\b/i.test(text)) return 'chat';
  return /\b(?:draw|paint|illustrate)\b|\b(?:generate|create|make|render|design)\b[\s\S]{0,100}\b(?:image|picture|photo|illustration|artwork|wallpaper|poster|logo)\b/i.test(text) ? 'image' : 'chat';
}
