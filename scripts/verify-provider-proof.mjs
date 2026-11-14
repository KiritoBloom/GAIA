const controller = new AbortController();
const stream = await fetch('http://127.0.0.1:4317/api/events', { signal: controller.signal });
if (!stream.ok || !stream.body) throw Error('Provider-proof event stream is unavailable.');
const reader = stream.body.getReader(), decoder = new TextDecoder();
let pending = '', result;
try {
  while (!result) {
    const next = await reader.read();
    if (next.done) throw Error('Provider-proof event stream ended before completion.');
    pending += decoder.decode(next.value, { stream: true });
    let end;
    while ((end = pending.indexOf('\n\n')) >= 0) {
      const block = pending.slice(0, end); pending = pending.slice(end + 2);
      const line = block.split('\n').find(value => value.startsWith('data: '));
      if (!line) continue;
      const message = JSON.parse(line.slice(6));
      if (message.type !== 'provider.proof.progress') continue;
      const progress = message.progress;
      console.log(JSON.stringify({ state: progress.state, completed: progress.completed, active: progress.active }));
      if (progress.state === 'passed' || progress.state === 'failed') result = progress.state;
    }
  }
} finally {
  await reader.cancel(); controller.abort();
}
if (result !== 'passed') process.exitCode = 1;
