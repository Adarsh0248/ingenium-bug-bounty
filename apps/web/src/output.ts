export function displayOutput(encoded: string | null) {
  if (encoded === null) return "";
  try {
    return new TextDecoder().decode(
      Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)),
    );
  } catch {
    return "Output unavailable";
  }
}
