# Synthetic language-parity lab only; the copied legacy isolator is not a security sign-off.
FROM judge0/judge0:1.13.1@sha256:6b5d6a66aa19a8e878a52ea3c6a560afc1086734d96e2885b561fd5c6018f082 AS legacy
FROM python:3.14.8-trixie@sha256:c23ebccb22bca6335521be462d1d4a3449a623c5ca8ce513d163c79c636dae79 AS python
FROM node:24.22.0-trixie@sha256:a3e43f3f15bea8c59c689afeebe63c945885677ae469ae8d12578567ef18f1df AS node
FROM eclipse-temurin:21.0.12.1_1-jdk-jammy@sha256:074d6f95f1e69965dbd23750a37ec3b234025d0864e9821e0b1fba0763a3e853 AS java
FROM gcc:15.3.0-trixie@sha256:980e5c2310bee44d11ee46964174cc11dfea822ba60f0d050d2161d63b64b8f5

COPY --from=python /usr/local/bin/python3.14 /usr/local/bin/python3.14
COPY --from=python /usr/local/lib/python3.14 /usr/local/lib/python3.14
COPY --from=python /usr/local/lib/libpython3.14.so* /usr/local/lib/
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/LICENSE /usr/local/share/licenses/node-LICENSE
COPY --from=java /opt/java/openjdk /usr/local/java
COPY --from=legacy /usr/local/bin/isolate /usr/local/bin/isolate
# Retain the tested isolator's small legacy dependency; review/replace before hostile code.
COPY --from=legacy /lib/x86_64-linux-gnu/libcap.so.2* /usr/local/lib/
COPY --from=legacy /usr/share/doc/libcap2/copyright /usr/local/share/licenses/libcap2-copyright
COPY --chown=0:0 --chmod=0444 lock.json runtime.py /usr/local/share/ingenium-profiles/
COPY --chown=0:0 fixtures/ /usr/local/share/ingenium-profiles/fixtures/
COPY --chown=0:0 --chmod=0444 limits.c /usr/local/share/ingenium-profiles/limits.c

ENV PATH=/usr/local/java/bin:/usr/local/bin:/usr/bin:/bin
ENV LD_LIBRARY_PATH=/usr/local/lib64:/usr/local/lib:/usr/local/java/lib:/usr/local/java/lib/server
ENV JAVA_HOME=/usr/local/java
ENV LANG=C.UTF-8
ENV PYTHONDONTWRITEBYTECODE=1

ARG BUNDLE_SHA256
LABEL ingenium.lab.profiles="1" ingenium.lab.bundle="${BUNDLE_SHA256}"
RUN test "${#BUNDLE_SHA256}" -eq 64 \
    && /usr/local/bin/gcc -std=c17 -O2 -Wall -Wextra -Werror \
       /usr/local/share/ingenium-profiles/limits.c -o /usr/local/bin/ingenium-exec \
    && chmod 0555 /usr/local/bin/ingenium-exec \
    && install -d -m 0755 /var/local/lib/isolate /usr/local/etc \
    && chown 0:0 /var/local /var/local/lib /var/local/lib/isolate /usr/local/bin/isolate \
    && chmod 00755 /var/local /var/local/lib /var/local/lib/isolate \
    && chmod 4755 /usr/local/bin/isolate \
    && printf '%s\n' 'box_root = /var/local/lib/isolate' 'cg_root = /sys/fs/cgroup' \
       'first_uid = 60000' 'first_gid = 60000' 'num_boxes = 1' > /usr/local/etc/isolate \
    && chmod 0444 /usr/local/etc/isolate \
    && /usr/local/bin/python3.14 -I -B /usr/local/share/ingenium-profiles/runtime.py --versions

USER 65534:65534
ENTRYPOINT ["/usr/bin/false"]
CMD []
