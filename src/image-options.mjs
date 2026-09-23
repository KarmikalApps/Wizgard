export const imageOptions = {
  qwen: { name:'Qwen Image 2.1', managerId:'image', steps:25, maxImages:10,
    description:'Create images and transform up to 10 ordered visual references.' },
  flux2: { name:'FLUX.2-dev', managerId:'flux2', steps:28, maxImages:10,
    description:'Generate and edit images with the 32B dev model. Start with 28 steps and guidance 4. Review outputs before sharing; the FLUX non-commercial model license applies.' },
};
export function normalizeImageSettings(settings) {
  const id = Object.hasOwn(imageOptions,settings.imageModel)?settings.imageModel:'qwen';
  return {...settings,imageModel:id,steps:settings.steps??imageOptions[id].steps,imageGuidance:settings.imageGuidance??4};
}
export function switchImageSettings(settings,id) {
  if(!Object.hasOwn(imageOptions,id))return settings;
  const profiles={...settings.imageProfiles,[settings.imageModel]:{width:settings.width,height:settings.height,steps:settings.steps,imageGuidance:settings.imageGuidance}};
  return normalizeImageSettings({...settings,...(profiles[id]||{steps:imageOptions[id].steps,imageGuidance:4}),imageModel:id,imageProfiles:profiles});
}
