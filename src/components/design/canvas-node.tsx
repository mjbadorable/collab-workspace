"use client";

import type { CSSProperties } from "react";
import type { Align, CanvasNode, Distribute } from "@/lib/design-storage";

const alignMap: Record<Align, CSSProperties["alignItems"]> = { start: "flex-start", center: "center", end: "flex-end" };
const distributeMap: Record<Distribute, CSSProperties["justifyContent"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
};

type Props = {
  node: CanvasNode;
  root?: boolean;
  zoom: number;
  selectedId: string | null;
  editingId: string | null;
  onTextChange: (id: string, text: string) => void;
  onStopEditing: () => void;
};

// Selection chrome is drawn at 1/zoom so handles and labels keep a constant on-screen size.
function SelectionChrome({ node, zoom }: { node: CanvasNode; zoom: number }) {
  const s = 8 / zoom;
  const corner = (style: CSSProperties) => (
    <span
      style={{ position: "absolute", width: s, height: s, background: "#fff", border: `${1 / zoom}px solid #6366f1`, ...style }}
    />
  );
  const size = `${node.widthMode === "fixed" ? node.width : "Hug"} × ${node.heightMode === "fixed" ? node.height : "Hug"}`;
  return (
    <span aria-hidden style={{ pointerEvents: "none" }}>
      {corner({ left: -s / 2, top: -s / 2 })}
      {corner({ right: -s / 2, top: -s / 2 })}
      {corner({ left: -s / 2, bottom: -s / 2 })}
      {corner({ right: -s / 2, bottom: -s / 2 })}
      <span
        style={{
          position: "absolute",
          left: "50%",
          top: "100%",
          marginTop: 8 / zoom,
          transform: `translateX(-50%) scale(${1 / zoom})`,
          transformOrigin: "top center",
          whiteSpace: "nowrap",
          background: "#6366f1",
          color: "#fff",
          fontSize: 11,
          lineHeight: "16px",
          padding: "0 6px",
          borderRadius: 4,
        }}
      >
        {size}
      </span>
    </span>
  );
}

export default function CanvasNodeView({ node, root, zoom, selectedId, editingId, onTextChange, onStopEditing }: Props) {
  const selected = node.id === selectedId;
  const isText = node.type === "text";
  const hasText = isText || node.type === "button";

  // Standard flexbox: the inspector's Auto Layout fields map one-to-one onto these properties.
  const style: CSSProperties = {
    position: root ? "absolute" : "relative",
    left: root ? node.x : undefined,
    top: root ? node.y : undefined,
    display: "flex",
    flexDirection: node.direction,
    gap: node.gap,
    padding: node.padding,
    alignItems: alignMap[node.align],
    justifyContent: distributeMap[node.distribute],
    width: node.widthMode === "fixed" ? node.width : "fit-content",
    height: node.heightMode === "fixed" ? node.height : "fit-content",
    boxSizing: "border-box",
    flexShrink: 0,
    background: isText ? undefined : node.fill,
    color: isText ? node.fill : node.type === "button" ? "#ffffff" : undefined,
    fontSize: isText ? node.fontSize : 14,
    fontWeight: node.type === "button" ? 500 : undefined,
    borderRadius: root ? 0 : 6,
    outline: selected ? `${2 / zoom}px solid #6366f1` : undefined,
  };
  if (node.type === "button") {
    style.alignItems = "center";
    style.justifyContent = "center";
  }

  return (
    <div data-node-id={node.id} style={style}>
      {root && (
        <span
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            marginBottom: 4 / zoom,
            transform: `scale(${1 / zoom})`,
            transformOrigin: "bottom left",
            whiteSpace: "nowrap",
            fontSize: 12,
            color: selected ? "#4f46e5" : "#6b7280",
            pointerEvents: "none",
          }}
        >
          {node.name}
        </span>
      )}

      {hasText &&
        (editingId === node.id ? (
          <input
            autoFocus
            value={node.text}
            onChange={(e) => onTextChange(node.id, e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={onStopEditing}
            onKeyDown={(e) => (e.key === "Enter" || e.key === "Escape") && e.currentTarget.blur()}
            aria-label="Edit text"
            className="select-text border-0 bg-transparent p-0 outline-none"
            style={{ font: "inherit", color: "inherit", width: `${Math.max(node.text.length, 1) + 1}ch` }}
          />
        ) : (
          <span style={{ whiteSpace: "pre" }}>{node.text}</span>
        ))}

      {node.type === "frame" &&
        node.children.map((child) => (
          <CanvasNodeView
            key={child.id}
            node={child}
            zoom={zoom}
            selectedId={selectedId}
            editingId={editingId}
            onTextChange={onTextChange}
            onStopEditing={onStopEditing}
          />
        ))}

      {selected && <SelectionChrome node={node} zoom={zoom} />}
    </div>
  );
}
