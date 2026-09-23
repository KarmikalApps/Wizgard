// Publisher-described variants; this does not describe license permissions.
const uncensoredIds = new Set(['chat', 'image', 'sulphur']);
export function modelDisplayName(model) {
  return model.name + (uncensoredIds.has(model.id || model.managerId) ? ' (Uncensored)' : '');
}
export const modelLabelNote = '“Uncensored” identifies a publisher-described variant. It does not guarantee no refusals or restrictions; model licenses and technical limits still apply.';
