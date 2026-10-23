# Manual Cloud Operations Rehearsal

This is an isolated test of the compiled offline observation/quarantine tools on
the existing Linux VM. It is not the event deployment, an installed judge test,
clock certification or permission to start an arena. The retained judge lab,
its files, volumes, records and stopped services must remain untouched.

## 1. Upload From Your Computer

Use the Cloud Shell **Upload file** control to upload this test-only archive to
your Cloud Shell home directory:

`apps/api/test-results/cloud-operations-20261022-v2.tar.gz`

SHA-256:

`e7b3f0d28772f16b75290170e89a00b2241a91116f18844b3cc922fb90a9379c`

It contains compiled public project code, migrations, the public role setup,
the test runner and production JavaScript dependencies. It contains no local
environment files, team codes, registration data or private runtime files.

## 2. In Cloud Shell

Run these in Cloud Shell, not inside the VM. Starting this existing VM uses
credits until it is stopped; its existing four-hour automatic stop is unchanged.
If Google reports no active account, use Cloud Shell's normal authorisation
prompt before continuing. Do not paste credentials into chat.

```bash
echo 'e7b3f0d28772f16b75290170e89a00b2241a91116f18844b3cc922fb90a9379c  cloud-operations-20261022-v2.tar.gz' | sha256sum -c -

gcloud compute instances start ingenium-judge-spike-01 \
  --project=project-8359d400-686c-4df3-a64 --zone=asia-south1-a

gcloud compute scp ~/cloud-operations-20261022-v2.tar.gz \
  ingenium-judge-spike-01:~/cloud-operations-20261022-v2.tar.gz \
  --project=project-8359d400-686c-4df3-a64 --zone=asia-south1-a \
  --tunnel-through-iap

gcloud compute ssh ingenium-judge-spike-01 \
  --project=project-8359d400-686c-4df3-a64 --zone=asia-south1-a \
  --tunnel-through-iap
```

Wait for each command to succeed. If SSH reports backend port 22 unavailable
immediately after starting, wait for the VM to boot; do not open public SSH or
alter firewall rules. Share the error if the connection remains unavailable.

## 3. Inside the VM

Check the prompt/hostname first. This block creates a fresh private directory;
it does not reuse any old probe directory. It downloads two pinned official
images, then runs a fresh synthetic database and restricted offline CLI process
without publishing ports. There is no real registration data or code execution.

```bash
(
  set -euo pipefail
  test "$(hostname)" = ingenium-judge-spike-01
  cd ~
  echo 'e7b3f0d28772f16b75290170e89a00b2241a91116f18844b3cc922fb90a9379c  cloud-operations-20261022-v2.tar.gz' | sha256sum -c -
  rehearsal="$(mktemp -d "$HOME/ingenium-operations-rehearsal.XXXXXX")"
  chmod 700 "$rehearsal"
  printf 'Rehearsal directory: %s\n' "$rehearsal"
  tar -xzf cloud-operations-20261022-v2.tar.gz -C "$rehearsal"
  cd "$rehearsal"
  sudo docker ps -a --filter label=com.docker.compose.project=ingenium-judge-spike \
    --format '{{.Names}} {{.State}}' > lab-before.txt
  bash infra/maintenance/test/cloud-operations.sh
  sudo docker ps -a --filter label=com.docker.compose.project=ingenium-judge-spike \
    --format '{{.Names}} {{.State}}' > lab-after.txt
  diff -u lab-before.txt lab-after.txt
)
```

Expected final line from the runner:

`PASS: isolated cloud CLI rehearsal completed; only its labelled temporary containers removed; original lab untouched.`

The final comparison should print nothing. Return the PASS lines or the first
failure. On failure, do not rerun, delete containers or clear files. Preserve the
printed rehearsal directory and output for inspection. The script only removes
its two specifically labelled test containers after a successful check; failures
retain them. No existing containers or volumes are restarted or removed.

## 4. Stop the VM

After success or a blocking failure, exit the VM to return to Cloud Shell, then:

```bash
gcloud compute instances stop ingenium-judge-spike-01 \
  --project=project-8359d400-686c-4df3-a64 --zone=asia-south1-a
```

Keep the VM and disk. This rehearsal does not resolve the separate production
judge installation, primary-host clock, public HTTPS, off-host backup, alerting
or full event-load gates.

## Result Received

On 23 October 2026 the user returned the expected final PASS for the v2 bundle,
including `linux_nonroot_cli`, private-runtime permissions, applied migrations,
the original quarantine receipt and read-only inventory. The reported result
kept `admission_allowed` and `live_deployment_verified` false. This is a narrow,
user-reported host rehearsal, not production installation or judge approval.
The bundle predates migration 0074, so it does not establish a VM test of that
later retention change. The user subsequently confirmed `TERMINATED` from the
Cloud Shell status check. That is user-reported shutdown, not an independent
cloud API inspection; the VM and disk were not reported deleted.
