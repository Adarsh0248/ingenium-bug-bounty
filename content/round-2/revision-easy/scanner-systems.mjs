// Authored subsystem ranges refer to the mutated body, before language wrappers.
export const systemsScanner = {
    "sector-offset-split": {
        label: "Byte address decomposition",
        c: [2, 7],
        python: [1, 5]
    },
    "payload-only-meter": {
        label: "Per-frame payload accounting",
        c: [5, 10],
        python: [4, 7]
    },
    "truncate-without-growth": {
        label: "Trim command application",
        c: [4, 10],
        python: [3, 6]
    },
    "overwrite-end-marker": {
        label: "Write extent and file length",
        c: [6, 11],
        python: [4, 8]
    },
    "cursor-at-end": {
        label: "Read clipping and cursor advance",
        c: [6, 15],
        python: [5, 11]
    },
    "severity-byte-filter": {
        label: "Log eligibility and byte accounting",
        c: [5, 12],
        python: [4, 8]
    },
    "checksum-byte-wrap": {
        label: "Byte checksum accumulation",
        c: [3, 8],
        python: [2, 5]
    },
    "minimum-packet-padding": {
        label: "Packet padding and wire cost",
        c: [8, 12],
        python: [6, 9]
    },
    "final-buffer-dispatch": {
        label: "Record buffering and final dispatch",
        c: [6, 17],
        python: [5, 12]
    },
    "clean-after-flush": {
        label: "Buffer write and flush state",
        c: [8, 13],
        python: [6, 10]
    },
    "rejected-byte-ledger": {
        label: "Whole-packet admission and loss accounting",
        c: [9, 13],
        python: [7, 10]
    },
    "partial-buffer-drain": {
        label: "Append and partial drain handling",
        c: [8, 15],
        python: [6, 11]
    },
    "suppressed-log-clock": {
        label: "Log suppression and written-time tracking",
        c: [6, 13],
        python: [5, 9]
    },
    "empty-file-still-exists": {
        label: "Directory presence and storage charges",
        c: [5, 11],
        python: [4, 7]
    },
    "one-terminator-per-record": {
        label: "Text record framing cost",
        c: [4, 9],
        python: [3, 6]
    },
    "drive-travel-ledger": {
        label: "Track movement and head update",
        c: [8, 13],
        python: [6, 10]
    },
    "block-wear-allowance": {
        label: "Per-block write admission",
        c: [7, 14],
        python: [6, 10]
    },
    "shared-log-header": {
        label: "Log record cost and quota admission",
        c: [10, 17],
        python: [8, 13]
    },
    "seek-from-file-end": {
        label: "Seek origin and cursor bounds",
        c: [9, 21],
        python: [7, 16]
    },
    "arrivals-before-service": {
        label: "Tick admission, overflow and service",
        c: [11, 21],
        python: [9, 17]
    },
    "whole-range-reservation": {
        label: "Whole-range conflict check and reservation",
        c: [10, 21],
        python: [8, 15]
    },
    "checkpoint-log-tail": {
        label: "Append, checkpoint and recovery boundaries",
        c: [10, 17],
        python: [8, 14]
    },
    "packed-record-boundary": {
        label: "Record completeness and payload consumption",
        c: [10, 20],
        python: [6, 13]
    },
    "cancel-a-waiting-print": {
        label: "Waiting job lookup and gap removal",
        c: [13, 25],
        python: [11, 19]
    },
    "discard-the-pending-slot": {
        label: "Stage, publish and discard state",
        c: [15, 27],
        python: [10, 19]
    }
};
