export function fileLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return ({md:"markdown",mdx:"markdown",ts:"typescript",tsx:"tsx",js:"javascript",jsx:"jsx",py:"python",json:"json",html:"html",css:"css",scss:"scss",yaml:"yaml",yml:"yaml",sh:"bash",ps1:"powershell",sql:"sql",rs:"rust",go:"go",java:"java",c:"c",cpp:"cpp",toml:"toml",xml:"xml"} as Record<string,string>)[ext] ?? "text";
}

export function sourceFence(content: string, language: string): string {
  const longest = Math.max(2, ...(content.match(/`+/g) ?? []).map(run => run.length));
  const fence = "`".repeat(longest + 1);
  return `${fence}${language}\n${content}\n${fence}`;
}
