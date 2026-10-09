import { createHash } from 'node:crypto';

// Pi may exit zero after an empty/error assistant message. A pre-tool progress
// sentence must never stand in for the terminal answer. Retain no reasoning or
// provider error text, only bounded status metadata and a digest when present.
export function piTerminalReceipt(input) {
  let last = null, messages = 0, providerErrors = 0;
  for (const line of input.split(/\r?\n/)) {
    let event; try { event = JSON.parse(line); } catch { continue; }
    if (event.type !== 'message_end' || event.message?.role !== 'assistant') continue;
    last = event.message; messages++;
    if (last.stopReason === 'error' || last.errorMessage) providerErrors++;
  }
  const text = (last?.content ?? []).filter(x => x.type === 'text').map(x => x.text).join('\n');
  const toolCalls = (last?.content ?? []).filter(x => x.type === 'toolCall').length;
  const complete = last?.stopReason === 'stop' && toolCalls === 0 && text.trim().length > 0 && providerErrors === 0;
  return {
    final_text: complete ? text : '',
    receipt: {
      assistant_messages: messages,
      terminal_stop_reason: ['stop', 'length', 'toolUse', 'error', 'aborted'].includes(last?.stopReason) ? last.stopReason : 'missing-or-other',
      terminal_tool_calls: toolCalls,
      terminal_text_characters: text.length,
      complete_final_answer: complete,
      provider_error_count: providerErrors,
      error_message_sha256: last?.errorMessage ? createHash('sha256').update(last.errorMessage).digest('hex') : null
    }
  };
}
