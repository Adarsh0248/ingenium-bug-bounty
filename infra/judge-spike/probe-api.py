import http.client
import ipaddress
import json
from pathlib import Path
import re
import sys


def request(host, method, path, token=None, body=None):
    headers = {"Content-Type": "application/json"}
    if token is not None:
        headers["X-Auth-Token"] = token
    connection = http.client.HTTPConnection(host, 2358, timeout=5)
    try:
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse()
        data = response.read(16385)
        if len(data) > 16384:
            raise RuntimeError("API response exceeded the probe limit.")
        return response.status, data
    finally:
        connection.close()


def check_api(host, token):
    status, _ = request(host, "GET", "/about")
    if status != 401:
        raise RuntimeError("Unauthenticated access was not rejected.")
    print("PASS: unauthenticated access rejected (401)")

    status, data = request(host, "GET", "/about", token)
    if status != 200 or json.loads(data).get("version") != "1.13.1":
        raise RuntimeError("Authenticated API version check failed.")
    print("PASS: authenticated Judge0 1.13.1 response (200)")

    # Empty payloads contain no runnable code, even if a configuration gate fails.
    status, data = request(host, "POST", "/submissions", token, b"{}")
    if status != 503 or not isinstance(json.loads(data).get("error"), str):
        raise RuntimeError("Maintenance mode did not reject submission creation.")
    print("PASS: maintenance mode rejects submission creation (503)")

    status, data = request(host, "POST", "/submissions/batch", token, b"{}")
    if status != 400 or json.loads(data).get("error") != "batched submissions are not allowed":
        raise RuntimeError("Batched submission restriction check failed.")
    print("PASS: batched submissions disabled (400)")


def main(argv=None):
    try:
        args = sys.argv[1:] if argv is None else argv
        if len(args) != 1:
            raise RuntimeError("Usage: python3 -B probe-api.py CONTAINER_PRIVATE_IPV4")
        try:
            address = ipaddress.IPv4Address(args[0])
        except ipaddress.AddressValueError:
            raise RuntimeError("Expected the API container's private IPv4 address.") from None
        if not any(address in ipaddress.IPv4Network(cidr) for cidr in (
            "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
        )):
            raise RuntimeError("Only RFC1918 private container IPv4 addresses are allowed.")
        try:
            raw = Path("secrets/api-token").read_bytes()
        except OSError:
            raise RuntimeError("Cannot read secrets/api-token.") from None
        if re.fullmatch(rb"[0-9a-f]{64}\n?", raw) is None:
            raise RuntimeError("Invalid API token file.")
        check_api(str(address), raw.rstrip(b"\n").decode("ascii"))
    except RuntimeError as error:
        print(f"FAIL: {error}", file=sys.stderr)
        return 1
    except ConnectionRefusedError:
        print("FAIL: API container refused the connection on port 2358.", file=sys.stderr)
        return 1
    except TimeoutError:
        print("FAIL: API container connection or response timed out.", file=sys.stderr)
        return 1
    except (OSError, http.client.HTTPException):
        print("FAIL: API container HTTP connection failed.", file=sys.stderr)
        return 1
    except (ValueError, AttributeError):
        print("FAIL: API returned an invalid JSON response.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
