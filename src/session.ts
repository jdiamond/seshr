export type SessionEntry = { line: number; value: Record<string, any> };

export type SessionTreeNode = {
  entry: SessionEntry;
  children: SessionTreeNode[];
};

export type SessionTree = {
  roots: SessionTreeNode[];
  leaves: SessionEntry[];
  paths: SessionEntry[][];
  errors: string[];
};

export type EventSelection = {
  selected: SessionEntry[];
  before: SessionEntry[];
  missingTimestamp: SessionEntry[];
};

export function parseSince(value: string, now = new Date()): number {
  const normalized = value.toLowerCase();
  if (normalized === "today" || normalized === "yesterday") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (normalized === "yesterday") start.setDate(start.getDate() - 1);
    return start.getTime();
  }
  const match = /^(\d+)([smhdw])$/i.exec(value);
  if (match) {
    const units: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
    return now.getTime() - Number(match[1]) * units[match[2].toLowerCase()];
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) throw new Error(`Invalid --since value: ${value}`);
  return timestamp;
}

export function selectEventsSince(entries: SessionEntry[], cutoff: number): EventSelection {
  const selected: SessionEntry[] = [];
  const before: SessionEntry[] = [];
  const missingTimestamp: SessionEntry[] = [];
  for (const entry of entries) {
    if (entry.value.type === "session") continue;
    const rawTimestamp = entry.value.timestamp;
    const timestamp = typeof rawTimestamp === "number"
      ? rawTimestamp
      : typeof rawTimestamp === "string" ? Date.parse(rawTimestamp) : Number.NaN;
    if (!Number.isFinite(timestamp)) missingTimestamp.push(entry);
    else if (timestamp >= cutoff) selected.push(entry);
    else before.push(entry);
  }
  return { selected, before, missingTimestamp };
}

export function buildSessionTree(entries: SessionEntry[]): SessionTree {
  const errors: string[] = [];
  const nodes = new Map<string, SessionTreeNode>();
  const orderedNodes: SessionTreeNode[] = [];

  for (const entry of entries) {
    const value = entry.value;
    if (value.type === "session") continue;
    if (typeof value.id !== "string" || !value.id) {
      errors.push(`Entry ${entry.line} has no ID`);
      continue;
    }
    if (nodes.has(value.id)) {
      errors.push(`Duplicate entry ID ${value.id} at line ${entry.line}`);
      continue;
    }
    const node = { entry, children: [] };
    nodes.set(value.id, node);
    orderedNodes.push(node);
  }

  const roots: SessionTreeNode[] = [];
  for (const node of orderedNodes) {
    const parentId = node.entry.value.parentId;
    if (parentId == null) {
      roots.push(node);
      continue;
    }
    const parent = nodes.get(parentId);
    if (!parent) {
      errors.push(`Entry ${node.entry.value.id} at line ${node.entry.line} has missing parent ${parentId}`);
      roots.push(node);
      continue;
    }
    parent.children.push(node);
  }

  const colors = new Map<string, number>();
  const inspectCycles = (node: SessionTreeNode) => {
    const id = node.entry.value.id as string;
    const color = colors.get(id) ?? 0;
    if (color === 1) {
      errors.push(`Cycle detected at entry ${id}`);
      return;
    }
    if (color === 2) return;
    colors.set(id, 1);
    for (const child of node.children) inspectCycles(child);
    colors.set(id, 2);
  };
  for (const node of orderedNodes) inspectCycles(node);

  const leaves: SessionEntry[] = [];
  const paths: SessionEntry[][] = [];
  const visited = new Set<string>();
  const walk = (node: SessionTreeNode, ancestors: SessionEntry[]) => {
    const id = node.entry.value.id as string;
    if (visited.has(id)) {
      errors.push(`Cycle detected at entry ${id}`);
      return;
    }
    const path = [...ancestors, node.entry];
    if (node.children.length === 0) {
      leaves.push(node.entry);
      paths.push(path);
      return;
    }
    visited.add(id);
    for (const child of node.children) walk(child, path);
    visited.delete(id);
  };
  for (const root of roots) walk(root, []);

  const reached = new Set(paths.flat().map((entry) => entry.value.id));
  for (const node of orderedNodes) {
    if (!reached.has(node.entry.value.id)) errors.push(`Entry ${node.entry.value.id} is not reachable from a root`);
  }

  return { roots, leaves, paths, errors };
}
