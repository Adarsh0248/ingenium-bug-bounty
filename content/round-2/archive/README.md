# Original Round 2 draft archive

`pack-original.json` preserves the 100 harder questions before the easier event revision. Its SHA-256 is `331237452da97700b928b07e9fb9b186643a85c3aa5778b55664be02faaf48cf`.

The archive includes organiser-authored references, buggy starters, hints, cases and paid intel in four event languages. It contains no participant submissions or live database records. It is now public because the competition is finished.

The source bodies in the parent directory (`arrays.mjs`, `systems.mjs`, `graphs.mjs`, `logic.mjs` and scanner modules) are the earlier authoring sources. The active generator uses `revision-easy/` to build the separate easier 100-question pack. The [additional twenty selection](../additional-20/README.md) reads this immutable archive, so rebuilding it does not depend on a private ignored tar file.

Content IDs are import-source identifiers, not live database IDs. Earlier draft definitions also received easy replacement versions in the event database. A future import of archived tasks must create appropriate distinct definitions and must not retarget existing questions or replay historical receipts.
