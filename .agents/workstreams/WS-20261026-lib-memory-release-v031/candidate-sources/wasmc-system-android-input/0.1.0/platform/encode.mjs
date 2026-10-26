// The v0.1 text command uses a u32 byte length. Legacy encoding remains
// available for peers that still consume the original u16 command.
export function encodeAndroidText(text, {legacy = false} = {}) {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  const bytes = new TextEncoder().encode(text);
  if (bytes.length === 0 || bytes.includes(0)) throw new RangeError('text must be nonempty and contain no NUL');
  const header = legacy ? 3 : 5;
  if (bytes.length > (legacy ? 0xffff : 0xffffffff - header)) throw new RangeError('text exceeds protocol framing');
  const frame = new Uint8Array(header + bytes.length), view = new DataView(frame.buffer);
  frame[0] = legacy ? 2 : 4;
  if (legacy) view.setUint16(1, bytes.length, true); else view.setUint32(1, bytes.length, true);
  frame.set(bytes, header);
  return frame;
}
