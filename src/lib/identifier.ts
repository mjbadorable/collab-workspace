// Pure helpers shared by the client dialog and the GitHub breakdown route.

// "Student Portal" -> "SP", "Mastersoft Grade Encoding Assistant" -> "MGEA", "Exam" -> "EXA"
export function suggestIdentifier(name: string): string {
  const words = name.trim().split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 5)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export const normalizeIdentifier = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
