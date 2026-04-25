const SECTION_WIDTH = 72;

function border(character: string): string {
  return character.repeat(SECTION_WIDTH);
}

export function formatLogSection(title: string): string {
  return [border("="), `= ${title}`, border("=")].join("\n");
}

export function formatLogSubsection(title: string): string {
  return [border("-"), `- ${title}`, border("-")].join("\n");
}

export function logSection(title: string): void {
  console.log(formatLogSection(title));
}

export function logSubsection(title: string): void {
  console.log(formatLogSubsection(title));
}
