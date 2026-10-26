# Frozen candidate runtime. Building it does not grant readiness or run participant code.
FROM judge0/judge0:1.13.1@sha256:6b5d6a66aa19a8e878a52ea3c6a560afc1086734d96e2885b561fd5c6018f082 AS legacy
FROM python:3.14.8-trixie@sha256:c23ebccb22bca6335521be462d1d4a3449a623c5ca8ce513d163c79c636dae79 AS python
FROM node:24.22.0-trixie@sha256:a3e43f3f15bea8c59c689afeebe63c945885677ae469ae8d12578567ef18f1df AS node
FROM eclipse-temurin:21.0.12.1_1-jdk-jammy@sha256:074d6f95f1e69965dbd23750a37ec3b234025d0864e9821e0b1fba0763a3e853 AS java
FROM gcc:15.3.0-trixie@sha256:980e5c2310bee44d11ee46964174cc11dfea822ba60f0d050d2161d63b64b8f5 AS native-build
COPY --chown=0:0 --chmod=0444 native/ /build/
RUN mkdir /output \
    && gcc -std=c17 -O2 -Wall -Wextra -Werror -static -s /build/phase-exec.c -o /output/ingenium-phase-exec \
    && gcc -std=c17 -O2 -Wall -Wextra -Werror -static -s /build/host-observe.c -o /output/host-observe \
    && gcc -std=c17 -O2 -Wall -Wextra -Werror -static -s /build/docker-peer-exec.c -o /output/peer-exec \
    && gcc -std=c17 -O2 -Wall -Wextra -Werror -static -s /build/launch.c -o /output/launch \
    && test "$(stat -c %s /output/host-observe)" -le 1048576 \
    && test "$(stat -c %s /output/launch)" -le 1048576 \
    && chmod 0555 /output/*

FROM scratch AS host-tools
COPY --from=native-build /output/ /

FROM gcc:15.3.0-trixie@sha256:980e5c2310bee44d11ee46964174cc11dfea822ba60f0d050d2161d63b64b8f5 AS runtime

COPY --from=python /usr/local/bin/python3.14 /usr/local/bin/python3.14
COPY --from=python /usr/local/lib/python3.14 /usr/local/lib/python3.14
COPY --from=python /usr/local/lib/libpython3.14.so* /usr/local/lib/
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/LICENSE /usr/local/share/licenses/node-LICENSE
COPY --from=java /opt/java/openjdk /usr/local/java
COPY --from=legacy /usr/local/bin/isolate /usr/local/bin/isolate
COPY --from=legacy /lib/x86_64-linux-gnu/libcap.so.2* /usr/local/lib/
COPY --from=legacy /usr/share/doc/libcap2/copyright /usr/local/share/licenses/libcap2-copyright
COPY --from=native-build --chown=0:0 --chmod=0555 /output/ingenium-phase-exec /usr/local/bin/ingenium-phase-exec
COPY --chown=0:0 --chmod=0444 app/judge/capsule-cli.js /opt/ingenium/judge-executor/app/judge/capsule-cli.js
COPY --chown=0:0 --chmod=0444 app/package.json /opt/ingenium/judge-executor/app/package.json
COPY --chown=0:0 --chmod=0444 security/isolate /usr/local/etc/isolate

RUN printf '%s\n' 'c8ad768bf22499f579eb07be75379c890347272de8190302b48b2bc0bab8d1d3  /usr/local/bin/isolate' | sha256sum -c - \
    && install -d -m 0755 /var/local/lib/isolate /usr/local/etc \
    && chown 0:0 /var/local /var/local/lib /var/local/lib/isolate /usr/local/bin/isolate \
    && chmod 0755 /var/local /var/local/lib /var/local/lib/isolate \
    && chmod 0555 /usr/local/bin/isolate \
    && for executable in /usr/local/bin/gcc /usr/local/bin/g++ /usr/local/bin/python3.14 /usr/local/bin/node /usr/local/java/bin/java /usr/local/java/bin/javac; do \
         install -m 0555 "$executable" "$executable.ingenium" && mv -T "$executable.ingenium" "$executable" || exit 1; \
       done \
    && chmod 0555 /opt/ingenium /opt/ingenium/judge-executor /opt/ingenium/judge-executor/app /opt/ingenium/judge-executor/app/judge

ENV PATH=/usr/local/java/bin:/usr/local/bin:/usr/bin:/bin
ENV LD_LIBRARY_PATH=/usr/local/lib64:/usr/local/lib:/usr/local/java/lib:/usr/local/java/lib/server
ENV JAVA_HOME=/usr/local/java LANG=C.UTF-8 PYTHONDONTWRITEBYTECODE=1
USER 65534:65534
ENTRYPOINT ["/usr/bin/false"]
CMD []
