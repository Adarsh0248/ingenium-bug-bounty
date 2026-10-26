# Seccomp source

`seccomp.json` is the upstream Moby default profile at commit
`6fe7deb1b9fb7c0397a4593480d7d22b9ee8caef`:
https://github.com/moby/profiles/blob/6fe7deb1b9fb7c0397a4593480d7d22b9ee8caef/seccomp/default.json

The only local change is a final newline. Its Apache 2.0 license is retained in
`LICENSE.moby`. The host release pins the exact local bytes. This is the outer
container policy; `native/phase-exec.c` installs the additional restrictions after
dropping privileges, before either compiler or submitted program can execute.
Copying this profile does not certify a host or replace the Linux rehearsal.
