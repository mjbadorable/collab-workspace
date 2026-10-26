"use client";

import { useState } from "react";
import { Handle, Position, useReactFlow, type Node, type NodeProps, type NodeTypes } from "@xyflow/react";

export type DiagramNodeData = { label: string; fields?: string[] };
export type DiagramNode = Node<DiagramNodeData>;

function EditableText({
  value,
  onCommit,
  multiline = false,
  className = "",
}: {
  value: string;
  onCommit: (next: string) => void;
  multiline?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };

  if (!editing) {
    return (
      <span
        className={`block whitespace-pre-wrap ${className}`}
        onDoubleClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {value || " "}
      </span>
    );
  }

  const shared = {
    autoFocus: true,
    value: draft,
    onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
    onBlur: commit,
    className: `nodrag nowheel nopan w-full resize-none rounded border border-indigo-300 bg-white px-1 text-neutral-900 outline-none ${className}`,
  };

  return multiline ? (
    <textarea
      {...shared}
      rows={Math.max(2, draft.split("\n").length)}
      onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
    />
  ) : (
    <input
      {...shared}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}

const handleClass = "!h-2.5 !w-2.5 !border-white !bg-indigo-500";

type Side = "top" | "right" | "bottom" | "left";

function Handles({ sides = ["top", "right", "bottom", "left"] }: { sides?: Side[] }) {
  const pos = { top: Position.Top, right: Position.Right, bottom: Position.Bottom, left: Position.Left };
  return sides.map((s) => <Handle key={s} id={s} type="source" position={pos[s]} className={handleClass} />);
}

function useLabel(id: string) {
  const { updateNodeData } = useReactFlow<DiagramNode>();
  return (label: string) => updateNodeData(id, { label });
}

function ProcessNode({ id, data, selected }: NodeProps<DiagramNode>) {
  const setLabel = useLabel(id);
  return (
    <div
      className={`min-w-36 rounded-lg border-2 bg-white px-4 py-3 text-center text-sm shadow-sm ${
        selected ? "border-indigo-500" : "border-neutral-300"
      }`}
    >
      <Handles />
      <EditableText value={data.label} onCommit={setLabel} />
    </div>
  );
}

function DecisionNode({ id, data, selected }: NodeProps<DiagramNode>) {
  const setLabel = useLabel(id);
  return (
    <div className="relative flex h-24 w-40 items-center justify-center">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 160 96" preserveAspectRatio="none">
        <polygon
          points="80,2 158,48 80,94 2,48"
          fill="white"
          strokeWidth={2}
          className={selected ? "stroke-indigo-500" : "stroke-neutral-300"}
        />
      </svg>
      <Handles />
      <div className="relative max-w-24 text-center text-sm">
        <EditableText value={data.label} onCommit={setLabel} />
      </div>
    </div>
  );
}

function TerminalNode({ id, data, selected }: NodeProps<DiagramNode>) {
  const setLabel = useLabel(id);
  return (
    <div
      className={`min-w-28 rounded-full border-2 bg-emerald-50 px-5 py-3 text-center text-sm ${
        selected ? "border-indigo-500" : "border-emerald-400"
      }`}
    >
      <Handles />
      <EditableText value={data.label} onCommit={setLabel} />
    </div>
  );
}

function TextNode({ id, data, selected }: NodeProps<DiagramNode>) {
  const setLabel = useLabel(id);
  return (
    <div className={`rounded px-2 py-1 text-sm text-neutral-700 ${selected ? "outline outline-1 outline-indigo-400" : ""}`}>
      <EditableText value={data.label} onCommit={setLabel} multiline />
    </div>
  );
}

function EntityNode({ id, data, selected }: NodeProps<DiagramNode>) {
  const setLabel = useLabel(id);
  const { updateNodeData } = useReactFlow<DiagramNode>();
  const fields = data.fields ?? [];
  return (
    <div
      className={`w-52 overflow-hidden rounded-lg border-2 bg-white text-sm shadow-sm ${
        selected ? "border-indigo-500" : "border-neutral-300"
      }`}
    >
      <Handles sides={["left", "right"]} />
      <div className="bg-indigo-600 px-3 py-1.5 font-medium text-white">
        <EditableText value={data.label} onCommit={setLabel} />
      </div>
      <div className="px-3 py-2 font-mono text-xs text-neutral-700">
        <EditableText
          multiline
          value={fields.join("\n")}
          onCommit={(next) => updateNodeData(id, { fields: next.split("\n").filter((l) => l.trim() !== "") })}
        />
      </div>
    </div>
  );
}

export const nodeTypes: NodeTypes = {
  process: ProcessNode,
  decision: DecisionNode,
  terminal: TerminalNode,
  text: TextNode,
  entity: EntityNode,
};
