import { CheckCircle2, Clock, Inbox, ListTodo } from "lucide-react";
import Greeting from "@/components/greeting";
import { mockStats, mockUser } from "@/lib/mock-data";

const stats = [
  { label: "Assigned & open", value: mockStats.assignedOpen, icon: ListTodo },
  { label: "Overdue", value: mockStats.overdue, icon: Clock },
  { label: "Completed", value: mockStats.completed, icon: CheckCircle2 },
];

export default function HomePage() {
  const firstName = mockUser.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Greeting name={firstName} />
      <p className="mt-1 text-sm text-neutral-500">Here&apos;s what&apos;s happening across your projects.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Icon className="h-4 w-4" />
              {label}
            </div>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col items-center rounded-lg border border-dashed border-neutral-300 px-6 py-16 text-center">
        <Inbox className="h-8 w-8 text-neutral-400" />
        <h2 className="mt-3 text-base font-medium">Nothing assigned to you</h2>
        <p className="mt-1 max-w-sm text-sm text-neutral-500">
          Work items assigned to you across projects show up here.
        </p>
      </div>
    </div>
  );
}
