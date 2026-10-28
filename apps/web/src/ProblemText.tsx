import { Fragment } from "react";

export function InlineCode({ children }: { children: string }) {
  return children
    .split(/(`[^`\n]+`)/)
    .map((part, index) =>
      part.startsWith("`") && part.endsWith("`") && part.length > 2 ? (
        <code key={index}>{part.slice(1, -1)}</code>
      ) : (
        <Fragment key={index}>{part}</Fragment>
      ),
    );
}

const headings = new Set([
  "What the code should do",
  "What's going wrong",
  "How to read the code",
  "Repair the program",
  "Input",
  "Output",
  "Example explained",
  "Limits",
]);

// Only headings and inline code are supported; all content stays escaped React text.
export default function ProblemText({ text }: { text: string }) {
  return (
    <div className="statement">
      {text.split(/\r?\n\s*\r?\n/).map((block, index) => {
        const [first, ...rest] = block.split(/\r?\n/);
        const heading = first.replace(/^#{1,4}\s+/, "");
        return (
          <Fragment key={index}>
            {headings.has(heading) ? (
              <>
                <h4>{heading}</h4>
                <p>
                  <InlineCode>{rest.join("\n")}</InlineCode>
                </p>
              </>
            ) : (
              <p>
                <InlineCode>{block}</InlineCode>
              </p>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
