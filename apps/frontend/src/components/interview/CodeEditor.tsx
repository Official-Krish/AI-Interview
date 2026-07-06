import { useRef, useEffect, useMemo } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { keymap, ViewPlugin } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";
import { python } from "@codemirror/lang-python";
import { javascript } from "@codemirror/lang-javascript";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { rust } from "@codemirror/lang-rust";
import { sql, MySQL } from "@codemirror/lang-sql";
import toast from "react-hot-toast";

const CODE_SAMPLES: Record<string, string> = {
  python: `def solution(nums, target):
    # Write your solution here
    pass`,
  javascript: `function solution(nums, target) {
  // Write your solution here
}`,
  typescript: `function solution(nums: number[], target: number): number[] {
  // Write your solution here
}`,
  java: `class Solution {
  public int[] solve(int[] nums, int target) {
    // Write your solution here
  }
}`,
  cpp: `class Solution {
public:
  vector<int> solve(vector<int>& nums, int target) {
    // Write your solution here
  }
};`,
  go: `func solve(nums []int, target int) []int {
  // Write your solution here
}`,
  rust: `fn solve(nums: Vec<i32>, target: i32) -> Vec<i32> {
  // Write your solution here
}`,
  swift: `func solve(_ nums: [Int], _ target: Int) -> [Int] {
  // Write your solution here
}`,
  kotlin: `fun solve(nums: IntArray, target: Int): IntArray {
  // Write your solution here
}`,
  sql: `SELECT
  department,
  COUNT(*) AS employee_count,
  ROUND(AVG(salary), 2) AS avg_salary
FROM employees
WHERE hire_date >= '2023-01-01'
GROUP BY department
HAVING COUNT(*) > 5
ORDER BY avg_salary DESC;`,
};

interface CodeEditorProps {
  language: string;
  code: string;
  onChange: (code: string) => void;
  readOnly?: boolean;
}

const LANGUAGE_NAMES: Record<string, string> = {
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  java: "Java",
  cpp: "C++",
  go: "Go",
  rust: "Rust",
  swift: "Swift",
  kotlin: "Kotlin",
  sql: "SQL",
};

function buildLanguageExtension(language: string) {
  switch (language) {
    case "python":
      return python();
    case "javascript":
      return javascript({ typescript: false });
    case "typescript":
      return javascript({ typescript: true });
    case "java":
      return java();
    case "cpp":
      return cpp();
    case "rust":
      return rust();
    case "sql":
      return sql({ dialect: MySQL });
    default:
      return python();
  }
}

const languageCompartment = new Compartment();
const editableCompartment = new Compartment();

const editorTheme = EditorView.theme({
  "&": {
    fontSize: "13px",
    height: "100%",
  },
  ".cm-scroller": {
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  },
  ".cm-content": {
    padding: "16px",
    caretColor: "#b8a88a",
  },
  "&.cm-focused .cm-cursorBar": {
    borderLeftColor: "#b8a88a",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-gutters": {
    display: "none",
  },
  ".cm-activeLineGutter": {
    display: "none",
  },
});

export function CodeEditor({
  language,
  code,
  onChange,
  readOnly,
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const initialCode = useMemo(() => {
    return code || CODE_SAMPLES[language] || CODE_SAMPLES.python!;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const preventPaste = ViewPlugin.fromClass(
      class {
        private lastToast = 0;
        constructor(view: EditorView) {
          view.dom.addEventListener("paste", (e: Event) => {
            e.preventDefault();
            const now = Date.now();
            if (now - this.lastToast > 3000) {
              this.lastToast = now;
              toast.error("Pasting is disabled during the interview", {
                duration: 2000,
              });
            }
          });
        }
      },
    );

    const state = EditorState.create({
      doc: initialCode,
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        oneDark,
        editorTheme,
        updateListener,
        languageCompartment.of(buildLanguageExtension(language)),
        editableCompartment.of(EditorView.editable.of(!readOnly)),
        preventPaste,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentDoc = view.state.doc.toString();
    if (code !== undefined && code !== currentDoc) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentDoc.length,
          insert: code,
        },
      });
    }
  }, [code]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: languageCompartment.reconfigure(
        buildLanguageExtension(language),
      ),
    });

    // Always swap starter code when language changes
    const sample = CODE_SAMPLES[language];
    if (sample) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: sample,
        },
      });
    }
  }, [language]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: editableCompartment.reconfigure(
        EditorView.editable.of(!readOnly),
      ),
    });
  }, [readOnly]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        borderRadius: "10px",
        border: "1px solid var(--color-border-light)",
        overflow: "hidden",
        background: "#1e1e1e",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "#252526",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "rgba(255,255,255,0.4)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {LANGUAGE_NAMES[language] ?? language}
        </span>
      </div>
      <div ref={containerRef} style={{ flex: 1, overflow: "auto" }} />
    </div>
  );
}
