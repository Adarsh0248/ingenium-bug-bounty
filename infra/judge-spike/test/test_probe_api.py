import contextlib
import http.client
import importlib.util
import io
from pathlib import Path
import unittest
from unittest.mock import Mock, call, patch


spec = importlib.util.spec_from_file_location("probe_api", Path(__file__).resolve().parent.parent / "probe-api.py")
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)
TOKEN = "a" * 64
HOST = "172.20.0.4"
RESPONSES = [
    (401, b""),
    (200, b'{"version":"1.13.1"}'),
    (503, b'{"error":"maintenance"}'),
    (400, b'{"error":"batched submissions are not allowed"}'),
]


class ProbeTests(unittest.TestCase):
    def test_all_gates_use_only_container_metadata_and_empty_payloads(self):
        with patch.object(probe, "request", side_effect=RESPONSES) as request, contextlib.redirect_stdout(io.StringIO()) as output:
            probe.check_api(HOST, TOKEN)
        self.assertEqual(request.call_args_list, [
            call(HOST, "GET", "/about"), call(HOST, "GET", "/about", TOKEN),
            call(HOST, "POST", "/submissions", TOKEN, b"{}"),
            call(HOST, "POST", "/submissions/batch", TOKEN, b"{}"),
        ])
        self.assertNotIn(TOKEN, output.getvalue())
        self.assertEqual(output.getvalue().count("PASS:"), 4)

    def test_each_failed_gate_stops_the_probe(self):
        for index in range(4):
            responses = list(RESPONSES)
            responses[index] = (200, b'{}')
            with self.subTest(index=index), patch.object(probe, "request", side_effect=responses) as request, contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaises(RuntimeError):
                    probe.check_api(HOST, TOKEN)
                self.assertEqual(request.call_count, index + 1)

    def test_invalid_token_never_makes_an_http_request(self):
        for value in [b"", b"g" * 64, b"a" * 63, b"a" * 64 + b"\n\n"]:
            with self.subTest(value=value), patch.object(probe.Path, "read_bytes", return_value=value), patch.object(probe, "request") as request, contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(probe.main([HOST]), 1)
                request.assert_not_called()

    def test_errors_do_not_print_response_bodies_or_credentials(self):
        with patch.object(probe.Path, "read_bytes", return_value=TOKEN.encode()), patch.object(probe, "request", side_effect=[RESPONSES[0], (200, TOKEN.encode())]), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()) as error:
            self.assertEqual(probe.main([HOST]), 1)
        self.assertNotIn(TOKEN, error.getvalue())

    def test_transport_targets_container_ip_and_bounds_the_response(self):
        connection = Mock()
        connection.getresponse.return_value.status = 200
        connection.getresponse.return_value.read.return_value = b'{}'
        with patch.object(probe.http.client, "HTTPConnection", return_value=connection) as constructor:
            self.assertEqual(probe.request(HOST, "GET", "/about", TOKEN), (200, b'{}'))
        constructor.assert_called_once_with(HOST, 2358, timeout=5)
        connection.getresponse.return_value.read.assert_called_once_with(16385)
        connection.close.assert_called_once()

    def test_connection_failures_and_oversized_responses_fail_closed(self):
        with patch.object(probe.Path, "read_bytes", return_value=TOKEN.encode()), patch.object(probe, "request", side_effect=http.client.HTTPException("private diagnostic")), contextlib.redirect_stderr(io.StringIO()) as error:
            self.assertEqual(probe.main([HOST]), 1)
        self.assertNotIn("private diagnostic", error.getvalue())
        connection = Mock()
        connection.getresponse.return_value.read.return_value = b"x" * 16385
        with patch.object(probe.http.client, "HTTPConnection", return_value=connection):
            with self.assertRaises(RuntimeError):
                probe.request(HOST, "GET", "/about", TOKEN)
        connection.close.assert_called_once()

    def test_invalid_targets_are_rejected_before_reading_credentials(self):
        for args in [[], [HOST, HOST], [""], ["127.0.0.1"], ["169.254.169.254"],
                     ["8.8.8.8"], ["172.32.0.1"], ["192.0.2.1"], ["0.0.0.0"],
                     ["::1"], ["localhost"], ["http://172.20.0.4"], ["172.20.0.4:2358"]]:
            with self.subTest(args=args), patch.object(probe.Path, "read_bytes") as read, patch.object(probe, "request") as request, contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(probe.main(args), 1)
                read.assert_not_called()
                request.assert_not_called()

    def test_all_rfc1918_ranges_are_accepted(self):
        for host in ["10.42.0.4", HOST, "192.168.0.4"]:
            with self.subTest(host=host), patch.object(probe.Path, "read_bytes", return_value=TOKEN.encode() + b"\n"), patch.object(probe, "request", side_effect=RESPONSES), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(probe.main([host]), 0)

    def test_connection_errors_are_categorized_without_raw_diagnostics(self):
        for exception, message in [
            (ConnectionRefusedError("private diagnostic"), "refused"),
            (TimeoutError("private diagnostic"), "timed out"),
            (OSError("private diagnostic"), "HTTP connection failed"),
        ]:
            with self.subTest(exception=type(exception)), patch.object(probe.Path, "read_bytes", return_value=TOKEN.encode()), patch.object(probe, "request", side_effect=exception), contextlib.redirect_stderr(io.StringIO()) as error:
                self.assertEqual(probe.main([HOST]), 1)
                self.assertIn(message, error.getvalue())
                self.assertNotIn("private diagnostic", error.getvalue())

    def test_missing_token_file_is_reported_without_its_contents(self):
        with patch.object(probe.Path, "read_bytes", side_effect=OSError("private diagnostic")), patch.object(probe, "request") as request, contextlib.redirect_stderr(io.StringIO()) as error:
            self.assertEqual(probe.main([HOST]), 1)
            self.assertIn("Cannot read secrets/api-token", error.getvalue())
            self.assertNotIn("private diagnostic", error.getvalue())
            request.assert_not_called()


if __name__ == "__main__":
    unittest.main()
