import { lazy, Suspense, useEffect, useState } from "react";
import type { Language } from "./types";
import { Boundary } from "./ui";

const loadEditor = () => import("./CodeEditor");
const CodeEditor = lazy(loadEditor);
export interface EditorProps {
  source: string;
  language: Language;
  readOnly: boolean;
  onChange: (text: string) => void;
}
export default function Editor(props: EditorProps) {
  const [plain, setPlain] = useState(false),
    [failed, setFailed] = useState(false),
    [editorReady, setEditorReady] = useState(false);
  useEffect(() => {
    let active = true;
    void loadEditor().then(
      () => {
        if (active) setEditorReady(true);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, []);
  const textarea = (
    <textarea
      aria-label="Your private code"
      spellCheck={false}
      value={props.source}
      readOnly={props.readOnly}
      onFocus={() => setPlain(true)}
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
      {plain || failed || !editorReady ? (
        textarea
      ) : (
        <Boundary fallback={textarea} onError={() => setFailed(true)}>
          <Suspense fallback={textarea}>
            <CodeEditor {...props} />
          </Suspense>
        </Boundary>
      )}
    </div>
  );
}
