import { Table } from "@cliffy/table";

export function generateHelp(command: any): string {
  const lines: string[] = [];
  
  lines.push(`Usage: ${command.getName()} [options] [command]`);
  lines.push("");
  lines.push(command.getDescription() || "");
  
  const allCommands = command.getCommands();
  if (allCommands.length > 0) {
    lines.push("");
    lines.push("Commands:");
    const cmdRows: string[][] = [];
  
    for (const cmd of allCommands) {
      const name = cmd.getName();
      const args = cmd.getArguments()
        .map((arg: any) => arg.optional ? `[${arg.name}]` : `<${arg.name}>`)
        .join(" ");
    
      cmdRows.push([`  ${name} ${args}`, cmd.getDescription()]);
    
      const arguments_ = cmd.getArguments();
      for (const arg of arguments_) {
        const argStr = (arg as any).optional ? `[${arg.name}]` : `<${arg.name}>`;
        const description = (arg as any).description ? ` ${arg.description}` : "";
        const requiredText = (arg as any).optional ? "(Optional)" : "(Required)";
        cmdRows.push([`    ${argStr}`, requiredText + (description || "")]);
      }

      const opts = cmd.getOptions();
      for (const opt of opts) {
        const flags = Array.isArray(opt.flags) ? opt.flags.join(", ") : (opt.flags || "");
        const desc = opt.description || "";
        cmdRows.push([`    ${flags}`, desc]);
      }
     
      cmdRows.push(["", ""]);
    }
    cmdRows.pop();
    lines.push(Table.from(cmdRows).padding(1).toString());
  }
  
  return lines.join("\n");
}
