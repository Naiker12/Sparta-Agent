/** Remove empty protocol debris only in assistant messages with actual tools.
 * Never interpret text as an executable call, or hide nonempty arguments/code.
 */
export function cleanToolProtocolDisplay(text: string, hasTools: boolean, streaming = false): string {
  if (!hasTools || !text.includes("<")) return text;
  let fence: { char: string; size: number } | undefined;
  return text.split(/(?<=\n)/).map((line, index, lines) => {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)/.exec(line);
    if (marker) {
      if (!fence) fence = { char: marker[1][0], size: marker[1].length };
      else if (marker[1][0] === fence.char && marker[1].length >= fence.size && !marker[2].trim()) fence = undefined;
      return line;
    }
    if (fence) return line;
    // Only a whole, unindented protocol-only line is debris. Inline mentions,
    // indented code, escaped tags and populated calls remain inspectable.
    const body = line.trimEnd();
    if (/^(?:<\/?tool_call>[ \t]*)+$/.test(body)) return "";
    if (streaming && index === lines.length - 1) {
      const tail = body.replace(/^(?:<\/?tool_call>[ \t]*)*/, "");
      if (tail.length >= 6 && ["<tool_call>", "</tool_call>"].some((tag) => tag.startsWith(tail))) return "";
    }
    return line;
  }).join("");
}
