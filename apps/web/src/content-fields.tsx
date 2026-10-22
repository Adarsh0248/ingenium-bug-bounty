import { useEffect, useRef } from "react";
import { Download, Upload } from "lucide-react";
import { IconButton } from "./ui";

export const textBytes = (value: string) =>
  new TextEncoder().encode(value).length;
export function contentTextError(value: string, max: number, prose = false) {
  return (
    !value.isWellFormed() ||
    textBytes(value) > max ||
    (prose && value.includes("\0"))
  );
}
export function decodeContentFile(bytes: Uint8Array, max: number) {
  if (bytes.length > max)
    throw new Error("File exceeds the field's byte limit.");
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
    bytes,
  );
}

export function TextField({
  name,
  value,
  max,
  prose = false,
  code = false,
  disabled,
  change,
  fail,
  reading,
}: {
  name: string;
  value: string;
  max: number;
  prose?: boolean;
  code?: boolean;
  disabled: boolean;
  change: (text: string) => void;
  fail: (message: string) => void;
  reading: (busy: boolean) => void;
}) {
  const file = useRef<HTMLInputElement>(null),
    generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const invalid = contentTextError(value, max, prose);
  return (
    <div className="content-text-field">
      <label>
        {name}
        <textarea
          aria-label={name}
          value={value}
          disabled={disabled}
          spellCheck={false}
          className={code ? "content-source" : undefined}
          aria-invalid={invalid || undefined}
          onChange={(e) => {
            generation.current++;
            change(e.target.value);
          }}
        />
      </label>
      <div className="content-byte-count">
        <span>
          {textBytes(value).toLocaleString()} / {max.toLocaleString()} bytes
        </span>
        <IconButton
          title={`Import ${name}`}
          disabled={disabled}
          onClick={() => file.current?.click()}
        >
          <Upload size={16} />
        </IconButton>
        <IconButton
          title={`Download ${name}`}
          disabled={disabled}
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([new TextEncoder().encode(value)], {
                type: "application/octet-stream",
              }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = `${name.toLowerCase().replaceAll(" ", "-")}.txt`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          <Download size={16} />
        </IconButton>
        <input
          ref={file}
          type="file"
          hidden
          aria-label={`File for ${name}`}
          disabled={disabled}
          onChange={async (e) => {
            const selected = e.target.files?.[0],
              current = ++generation.current;
            e.target.value = "";
            if (!selected) return;
            reading(true);
            try {
              if (selected.size > max)
                throw new Error("File exceeds the field's byte limit.");
              const text = decodeContentFile(
                new Uint8Array(await selected.arrayBuffer()),
                max,
              );
              if (prose && text.includes("\0"))
                throw new Error("Prose cannot contain NUL bytes.");
              if (current === generation.current) change(text);
            } catch (e) {
              if (current === generation.current)
                fail(
                  e instanceof Error
                    ? e.message
                    : "The file could not be read.",
                );
            } finally {
              reading(false);
            }
          }}
        />
      </div>
      {invalid && (
        <p className="error" role="alert">
          Invalid text or byte limit exceeded. Nothing has been truncated.
        </p>
      )}
    </div>
  );
}
