import { spawn } from "node:child_process";

/** Keep a failed renderer confined to its document instead of crashing Node.
 * Drain stdout, bound diagnostic memory, and listen to stdin errors BEFORE
 * writing: a child that exits early can emit EPIPE on this separate stream.
 */
export function runDocumentProcess(command: string, args: string[], input: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { timeout: timeoutMs, killSignal: "SIGKILL" });
    let stderr = "";
    let inputError: Error | undefined;
    child.stdout.resume();
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-16000);
    });
    child.stdin.on("error", (error: Error) => { inputError = error; });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code !== 0 || signal || inputError) {
        reject(new Error(
          `Document renderer failed (${signal || `exit ${code}`}): ` +
          (stderr.trim().slice(-800) || inputError?.message || "Renderer exited without a result."),
        ));
      } else {
        resolve();
      }
    });
    child.stdin.end(input);
  });
}
