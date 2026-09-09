import { env, pipeline, TextStreamer } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm';

env.allowRemoteModels = true;
env.allowLocalModels = false;
env.useBrowserCache = true;

let modelPipeline;

self.onmessage = async (event) => {
  const input = event.data;
  try {
    if (!modelPipeline) {
      self.postMessage({ status: 'loading' });
      modelPipeline = await pipeline(input.task, input.model, {
        device: input.device,
        dtype: input.dtype,
        progress_callback: (progress) => self.postMessage(progress)
      });
      self.postMessage({ status: 'ready' });
    }

    const streamer = new TextStreamer(modelPipeline.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text) => self.postMessage({ status: 'update', output: text })
    });

    const message = input.system_role
      ? [
          { role: 'system', content: input.system_role },
          { role: 'user', content: input.text || '' }
        ]
      : (input.text || '');

    await modelPipeline(message, {
      ...input.parameters,
      return_full_text: false,
      streamer
    });

    self.postMessage({ status: 'complete' });
  } catch (error) {
    self.postMessage({ status: 'error', output: error instanceof Error ? error.message : String(error) });
  }
};
