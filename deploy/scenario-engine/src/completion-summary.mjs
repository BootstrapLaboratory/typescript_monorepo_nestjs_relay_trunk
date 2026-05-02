export function formatCompletionSections(scenario, values) {
  const sections = scenario.completionSections ?? [];

  return sections
    .map((section) => formatCompletionSection(section, values))
    .filter((section) => section !== "")
    .join("\n\n");
}

function formatCompletionSection(section, values) {
  const lines = [`${section.title}:`];

  if (section.guide !== undefined && section.guide !== "") {
    lines.push(interpolateValueReferences(section.guide, values));
  }

  if (section.variables !== undefined) {
    for (const variable of section.variables) {
      lines.push(`  ${variable}=${values[variable] ?? "(missing)"}`);
    }
  }

  if (section.lines !== undefined) {
    for (const line of section.lines) {
      lines.push(`  ${interpolateValueReferences(line, values)}`);
    }
  }

  return lines.join("\n");
}

function interpolateValueReferences(text, values) {
  return text.replace(/\$\{(?<name>[A-Z0-9_]+)\}/g, (match, name) => {
    const value = values[name];
    return value === undefined || value === "" ? match : String(value);
  });
}
