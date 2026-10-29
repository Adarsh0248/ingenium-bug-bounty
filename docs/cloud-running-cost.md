# Current cloud running-cost estimate

Checked 29 October 2026 against the project's actual VM/disk/address inventory
and Google's public Mumbai (`asia-south1`) on-demand price tables. This estimates
ongoing usage, not the amount already billed or the remaining trial balance.

| Resource | Configuration | USD per 730-hour month |
| --- | --- | ---: |
| Running app VM | `ingenium-app-01`, E2 standard 2, 2 vCPU / 8 GiB, $0.08048436/hour | $58.75 |
| App boot disk | 20 GiB standard persistent disk, $0.048/GiB-month | $0.96 |
| App data disk | 64 GiB balanced persistent disk, $0.12/GiB-month | $7.68 |
| App public IPv4 | One in-use standard-VM address, $0.005/hour | $3.65 |
| **App hosting subtotal** | Approximately $0.0973/hour or $2.34/day | **$71.04** |
| Retained judge disks | Two 60 GiB balanced disks; both judge VMs are stopped | $14.40 |
| **Current resource subtotal** | App hosting plus the retained test disks | **$85.44** |

This excludes outgoing network traffic, any additional snapshots, logs or other
billable services, applicable taxes, negotiated discounts and trial credits.
The VMs' CPU/RAM stop charging while stopped; retained disks continue charging.
No old judge VM or disk was deleted or restarted while checking costs. If the
judge is started for validation or the event, its running compute is additional.

For an illustrative conversion at **₹90 per USD**, app hosting is about
**₹6,400/month**, and the listed current resources total about **₹7,700/month**
before taxes and traffic. This is an explicit conversion assumption, not a
current exchange-rate quote; Google's INR SKU prices and account bill govern.
Eligible remaining trial credits reduce cash payable, but the balance has not
been checked.

The app VM hosts the API, frontend, local PostgreSQL and Caddy. There is no
separate managed Cloud SQL instance in this hosting estimate. Public DNS/TLS
currently use the existing sslip.io address and Caddy certificate.

Sources: [Compute Engine general-purpose pricing](https://cloud.google.com/products/compute/pricing/general-purpose),
[Persistent Disk pricing](https://cloud.google.com/compute/disks-image-pricing),
[external IPv4 and network pricing](https://cloud.google.com/vpc/network-pricing).
Select **Mumbai (asia-south1)** in the regional tables. Raw fetched tables and
source-free calculations are retained only under the ignored local `build/`.
