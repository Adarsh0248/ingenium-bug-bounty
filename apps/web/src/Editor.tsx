import { useEffect, useRef, useState } from "react";
import * as monaco from "monaco-editor/editor/editor.api.js";
import "monaco-editor/languages/definitions/cpp/register.js";
import "monaco-editor/languages/definitions/java/register.js";
import "monaco-editor/languages/definitions/python/register.js";
import "monaco-editor/languages/definitions/javascript/register.js";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";
import type { Language } from "./types";
self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
monaco.editor.defineTheme("ingenium", {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#101218",
    "editorLineNumber.foreground": "#747f92",
    "editor.lineHighlightBackground": "#1a2029",
    "editorCursor.foreground": "#5ef3e6",
  },
});
export default function Editor({
  source,
  language,
  readOnly,
  onChange,
}: {
  source: string;
  language: Language;
  readOnly: boolean;
  onChange: (text: string) => void;
}) {
  const element = useRef<HTMLDivElement>(null),
    editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null),
    change = useRef(onChange),
    applying = useRef(false);
  change.current = onChange;
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    if (fallback) return;
    const model = monaco.editor.createModel(
        source,
        language === "c" ? "cpp" : language,
      ),
      instance = monaco.editor.create(element.current!, {
        model,
        theme: "ingenium",
        automaticLayout: true,
        readOnly,
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: "Consolas, monospace",
        lineNumbersMinChars: 3,
        scrollBeyondLastLine: false,
        wordWrap: "on",
        padding: { top: 18, bottom: 16 },
        accessibilitySupport: "on",
        ariaLabel: "Your private code",
        tabSize: 4,
        renderWhitespace: "selection",
        quickSuggestions: false,
        suggestOnTriggerCharacters: false,
        contextmenu: false,
      });
    editor.current = instance;
    const event = instance.onDidChangeModelContent(() => {
      if (!applying.current) change.current(instance.getValue());
    });
    return () => {
      event.dispose();
      instance.dispose();
      model.dispose();
      editor.current = null;
    };
  }, [language, fallback]);
  useEffect(() => {
    const e = editor.current;
    if (e && e.getValue() !== source) {
      const position = e.getPosition();
      applying.current = true;
      try {
        e.setValue(source);
        if (position) e.setPosition(position);
      } finally {
        applying.current = false;
      }
    }
  });
  useEffect(() => editor.current?.updateOptions({ readOnly }), [readOnly]);
  return (
    <div className="editor-container">
      <button
        className="text-button editor-mode"
        onClick={() => setFallback(!fallback)}
      >
        {fallback ? "Code editor" : "Plain text"}
      </button>
      {fallback ? (
        <textarea
          aria-label="Your private code"
          spellCheck={false}
          value={source}
          readOnly={readOnly}
          onChange={(e) => onChange(e.target.value)}
          className="plain-editor"
        />
      ) : (
        <div className="monaco-host" ref={element} />
      )}
    </div>
  );
}
