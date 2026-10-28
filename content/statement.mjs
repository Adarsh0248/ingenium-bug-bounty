export function statementFor(q, round) {
  const region = round === 2 ? "THE KERNEL BREACH" : q.region;
  const story = !q.incident.includes("security AI")
    ? "AEGIS is the network's security AI. It now blocks its human operators. " +
      q.incident
    : q.incident;
  const repair =
    round === 1
      ? "Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format."
      : "Fix the logic in the given program. You may change how it works, but keep the same input and output format.";
  return `PROTOCOL REBELLION / ${region}\n${story}\n\nWhat the code should do\n${q.task}\n\nWhat's going wrong\n${q.symptom}\n\nHow to read the code\n${q.guide}\n\nRepair the program\n${repair}\n\nInput\n${q.input}\n\nOutput\n${q.output}\n\nExample explained\n${q.example}\n\nLimits\n${q.constraints}\n\nYou can solve this mission on its own, in any order.`;
}
