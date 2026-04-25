const SECTION_WIDTH = 72;

function border(character: string): string {
  return character.repeat(SECTION_WIDTH);
}

export function formatValidationSection(title: string): string {
  return [border("="), `= ${title}`, border("=")].join("\n");
}

export function formatValidationTargetHeader(target: string): string {
  return [
    border("-"),
    `- Validation target: ${target}`,
    border("-"),
  ].join("\n");
}

export function logValidationSection(title: string): void {
  console.log(formatValidationSection(title));
}

export function logValidationTargetHeader(target: string): void {
  console.log(formatValidationTargetHeader(target));
}
