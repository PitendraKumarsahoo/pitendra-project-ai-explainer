import { useState } from "react";
import { ChevronRight, File, Folder } from "lucide-react";
import type { TreeNode } from "@/lib/analysis";
import { formatBytes } from "@/lib/analysis";
import { cn } from "@/lib/utils";

export function FileTree({
  node,
  depth = 0,
  onSelect,
  selected,
}: {
  node: TreeNode;
  depth?: number;
  onSelect: (path: string) => void;
  selected: string | null;
}) {
  const [open, setOpen] = useState(depth < 2);

  if (node.type === "file") {
    return (
      <button
        onClick={() => onSelect(node.path)}
        className={cn(
          "flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left font-mono text-xs transition-colors hover:bg-secondary",
          selected === node.path ? "bg-secondary text-primary" : "text-muted-foreground",
        )}
        style={{ paddingLeft: depth * 12 + 8 }}
      >
        <File className="size-3 shrink-0 opacity-60" />
        <span className="truncate">{node.name}</span>
        <span className="ml-auto shrink-0 text-[10px] opacity-50">{formatBytes(node.size)}</span>
      </button>
    );
  }

  return (
    <div>
      {depth > 0 && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left font-mono text-xs text-foreground transition-colors hover:bg-secondary"
          style={{ paddingLeft: depth * 12 + 8 }}
        >
          <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} />
          <Folder className="size-3 shrink-0 text-primary/70" />
          <span className="truncate">{node.name}</span>
        </button>
      )}
      {open &&
        node.children?.map((child) => (
          <FileTree
            key={child.path}
            node={child}
            depth={depth + 1}
            onSelect={onSelect}
            selected={selected}
          />
        ))}
    </div>
  );
}
