import {setTimeout as delay} from 'node:timers/promises';

export function transientProviderError(error) {
  return /timed?\s*out|timeout|connection (?:reset|refused|closed)|temporary failure|temporarily unavailable|urlopen error|network|HTTP (?:408|429|5\d\d)\b/i.test(String(error?.message||error));
}
export async function providerRequest(work,signal,onRetry,wait=delay) {
  for(;;){
    signal?.throwIfAborted();
    try{return await work();}catch(error){
      if(signal?.aborted||!transientProviderError(error))throw error;
      onRetry(error);
      await wait(15_000,undefined,{signal});
    }
  }
}
