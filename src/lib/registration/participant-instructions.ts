/** Split participant_instructions into non-empty lines for prep chrome. */
export function participantInstructionLines(instructions: string | null | undefined): string[] {
  return (instructions ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
