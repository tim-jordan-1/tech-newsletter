import { execFile as _execFile } from 'node:child_process';

type ExecFileFn = (
  file: string,
  args: string[],
  callback: (err: Error | null, stdout: string, stderr: string) => void
) => void;

export async function callClaude(
  prompt: string,
  execFileFn: ExecFileFn = _execFile
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFileFn('claude', ['-p', prompt], (err, stdout) => {
      if (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          reject(new Error('claude CLI not found — is Claude Code installed and authenticated?'));
        } else {
          reject(err);
        }
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

export type { ExecFileFn };
