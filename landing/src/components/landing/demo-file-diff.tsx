/** Desktop-style old/new gutters over local proposal lines. */
export function DemoFileDiff({ lines }: { lines: string[] }) {
  let oldNumber = 0;
  let newNumber = 0;
  return <div className="demo-file-diff" aria-label="Diferencias entre original y propuesta">{lines.map((line, index) => {
    const added = line.startsWith('+'); const removed = line.startsWith('-');
    const oldLine = added ? '' : ++oldNumber; const newLine = removed ? '' : ++newNumber;
    return <div key={index} data-change={added ? 'added' : removed ? 'removed' : 'context'}><span aria-hidden="true">{oldLine}</span><span aria-hidden="true">{newLine}</span><code>{added || removed ? line : ` ${line}`}</code></div>;
  })}</div>;
}
