// Mock data for previewing the UI before Supabase is wired up.

export type MockUser = { id: string; name: string; email: string };
export type MockProject = { id: string; name: string; identifier: string };

export const mockUser: MockUser = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Marvin Adorable",
  email: "adorablemarvinjhay@gmail.com",
};

export const mockWorkspace = { name: "DevOps Workspace" };

export const mockProjects: MockProject[] = [{ id: "exam-reviewer-app", name: "Exam Reviewer App", identifier: "ERA" }];


export const mockStats = { assignedOpen: 0, overdue: 0, completed: 0 };

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}
