export const chatOptions={
 qwen:{name:'Qwen 3.8 · HauhauCS',managerId:'chat',engine:'ollama',alias:'wizgard-qwen3.8:latest',vision:true,ids:['chat','chat-projector'],catalogFile:'model-manifest.json',stateFile:'models/installed.json'},
 orca:{name:'Qwen 3.8 · OrcaRouter',managerId:'orca',engine:'ollama',alias:'wizgard-qwen3.8-orca:latest',vision:true,ids:['orca-chat','orca-projector'],catalogFile:'optional-model-manifest.json',stateFile:'models/optional-installed.json'},
 deepseek41:{name:'DeepSeek V4.1 Flash 1017',managerId:'deepseek41',engine:'llama',vision:true,ids:['deepseek41-1','deepseek41-2','deepseek41-3','deepseek41-4','deepseek41-5','deepseek41-6','deepseek41-projector'],catalogFile:'optional-model-manifest.json',stateFile:'models/optional-installed.json'},
};
export function chatOption(id='qwen'){if(!Object.hasOwn(chatOptions,id))throw new Error('Choose an available chat model.');return chatOptions[id];}
