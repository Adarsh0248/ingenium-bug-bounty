# Historical infrastructure allocation

The event used a separate application host (2 vCPUs / 8 GiB) and a judge host (14 vCPUs / 56 GiB) under the approved quota. Sixteen execution slots fit within that judge allocation with explicit CPU, memory, process and database limits. Slots are bounded concurrency permits, not a promise of one dedicated CPU each.

This is a completed-event engineering record. It is not a current cloud inventory, price quote, billing total or confirmation that resources have been stopped. Open-source preparation did not query or change the former cloud project. Current prices, resource state and retention costs must be checked by the account owner in their billing/compute console before planning a fork.

Private project IDs, addresses, named disks, root receipts and account-specific cost worksheets are retained outside this public repository. [The retrospective](history/event-retrospective.md) describes the measured capacity and remaining latency limits.
