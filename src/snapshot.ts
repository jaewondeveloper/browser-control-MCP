import type { Page } from "playwright";

export type RefMeta = { selector: string };

let refCounter = 0;
const refStore = new Map<string, RefMeta>();

export function resetRefStore(): void {
  refCounter = 0;
  refStore.clear();
}

export function getRefStore(): Map<string, RefMeta> {
  return refStore;
}

export type SnapshotOptions = {
  /** Fewer nodes — use before full browser_snapshot when checking page state */
  quick?: boolean;
};

export async function captureAccessibilitySnapshot(
  page: Page,
  options: SnapshotOptions = {}
): Promise<string> {
  resetRefStore();
  const quick = options.quick ?? false;

  const tree = await page.evaluate((quickMode) => {
    const limits = {
      maxDepth: quickMode ? 7 : 14,
      maxNodes: quickMode ? 100 : 400,
      pruneWideAt: quickMode ? 3 : 6,
      maxSiblings: quickMode ? 24 : 80,
    };
    let nodeCount = 0;
    type NodeOut = {
      role: string;
      name: string;
      tag: string;
      selector: string;
      children: NodeOut[];
    };

    function visible(el: Element): boolean {
      const style = window.getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    function roleOf(el: Element): string {
      const explicit = el.getAttribute("role");
      if (explicit) return explicit;
      const tag = el.tagName.toLowerCase();
      const map: Record<string, string> = {
        a: "link",
        button: "button",
        input: "textbox",
        textarea: "textbox",
        select: "combobox",
        img: "img",
        h1: "heading",
        h2: "heading",
        h3: "heading",
        nav: "navigation",
        main: "main",
        form: "form",
      };
      if (tag === "input") {
        const t = (el as HTMLInputElement).type;
        if (t === "checkbox") return "checkbox";
        if (t === "radio") return "radio";
        if (t === "submit" || t === "button") return "button";
      }
      return map[tag] ?? tag;
    }

    function nameOf(el: Element): string {
      const aria =
        el.getAttribute("aria-label") ||
        el.getAttribute("title") ||
        el.getAttribute("placeholder");
      if (aria) return aria.trim();
      const labelled = el.getAttribute("aria-labelledby");
      if (labelled) {
        const labelEl = document.getElementById(labelled);
        if (labelEl?.textContent) return labelEl.textContent.trim();
      }
      const text = (el as HTMLElement).innerText?.trim().split("\n")[0];
      if (text && text.length < 80) return text;
      if (el.tagName === "IMG") return (el as HTMLImageElement).alt ?? "";
      return "";
    }

    function cssPath(el: Element): string {
      if (el.id) return `#${CSS.escape(el.id)}`;
      const parts: string[] = [];
      let cur: Element | null = el;
      while (cur && cur.nodeType === 1 && cur !== document.body) {
        let part = cur.tagName.toLowerCase();
        const parent: Element | null = cur.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(
            (c: Element) => c.tagName === cur!.tagName
          );
          if (siblings.length > 1) {
            const idx = siblings.indexOf(cur) + 1;
            part += `:nth-of-type(${idx})`;
          }
        }
        parts.unshift(part);
        cur = parent;
      }
      return parts.join(" > ");
    }

    const interactive = new Set([
      "a",
      "button",
      "input",
      "select",
      "textarea",
      "summary",
      "[role=button]",
      "[role=link]",
      "[role=checkbox]",
      "[role=menuitem]",
      "[role=tab]",
    ]);

    function shouldInclude(el: Element): boolean {
      if (!visible(el)) return false;
      const tag = el.tagName.toLowerCase();
      const role = roleOf(el);
      if (interactive.has(tag) || el.hasAttribute("role")) return true;
      if (["h1", "h2", "h3", "h4", "nav", "main", "form"].includes(tag)) return true;
      if (role === "heading" || role === "link" || role === "button") return true;
      return false;
    }

    function walk(el: Element, depth: number): NodeOut | null {
      if (nodeCount >= limits.maxNodes) return null;
      if (depth > limits.maxDepth && !shouldInclude(el)) return null;

      const rawChildren = Array.from(el.children);
      let childrenToWalk = rawChildren;
      if (depth >= limits.pruneWideAt && rawChildren.length > limits.maxSiblings) {
        const picked: Element[] = [];
        for (const c of rawChildren) {
          if (shouldInclude(c)) picked.push(c);
          if (picked.length >= limits.maxSiblings) break;
        }
        childrenToWalk = picked.length ? picked : rawChildren.slice(0, limits.maxSiblings);
      }

      const kids: NodeOut[] = [];
      for (const child of childrenToWalk) {
        if (nodeCount >= limits.maxNodes) break;
        const sub = walk(child, depth + 1);
        if (sub) kids.push(sub);
      }

      if (!shouldInclude(el) && kids.length === 0) return null;

      nodeCount++;
      return {
        role: roleOf(el),
        name: nameOf(el),
        tag: el.tagName.toLowerCase(),
        selector: cssPath(el),
        children: kids,
      };
    }

    const root = document.body;
    const out = walk(root, 0);
    return out ? [out] : [];
  }, quick);

  const lines: string[] = [];

  function format(nodes: typeof tree, depth: number): void {
    for (const n of nodes) {
      const ref = `e${++refCounter}`;
      refStore.set(ref, { selector: n.selector });
      const indent = "  ".repeat(depth);
      const label = n.name ? `${n.role} "${n.name}"` : n.role;
      lines.push(`${indent}- ${label} [ref=${ref}]`);
      if (n.children.length) format(n.children, depth + 1);
    }
  }

  format(tree, 0);
  return lines.length ? lines.join("\n") : "(no interactive elements found)";
}

export async function resolveRefToCenter(
  page: Page,
  ref: string
): Promise<{ x: number; y: number } | null> {
  const meta = refStore.get(ref);
  if (!meta) return null;

  const locator = page.locator(meta.selector).first();
  const count = await locator.count();
  if (count === 0) return null;

  const box = await locator.boundingBox();
  if (!box) return null;

  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
