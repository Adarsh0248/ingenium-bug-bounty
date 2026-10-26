import { lazy, Suspense, useState } from "react";
import type { Language } from "./types";
import { Boundary } from "./ui";

const CodeEditor = lazy(() => import("./CodeEditor"));
export interface EditorProps {
  source: string;
  language: Language;
  readOnly: boolean;
  onChange: (text: string) => void;
}
export default function Editor(props: EditorProps) {
  const [plain, setPlain] = useState(false),
    [failed, setFailed] = useState(false);
  const textarea = (
    <textarea
      aria-label="Your private code"
      spellCheck={false}
      value={props.source}
      readOnly={props.readOnly}
      onChange={(e) => props.onChange(e.target.value)}
      className="plain-editor"
    />
  );
  return (
    <div className="editor-container">
      {failed ? (
        <span className="editor-mode" role="status">
          Plain text / code editor unavailable
        </span>
      ) : (
        <button
          className="text-button editor-mode"
          onClick={() => setPlain(!plain)}
        >
          {plain ? "Code editor" : "Plain text"}
        </button>
      )}
      {plain || failed ? (
        textarea
      ) : (
        <Boundary fallback={textarea} onError={() => setFailed(true)}>
          <Suspense
            fallback={
              <div className="editor-loading" role="status">
                Loading editor...
              </div>
            }
          >
            <CodeEditor {...props} />
          </Suspense>
        </Boundary>
      )}
    </div>
  );
}
