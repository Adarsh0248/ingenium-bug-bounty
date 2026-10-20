import unittest
from probe import nanos, tracking


TRACKING = "A9FEA9FE,metadata.google.internal,3,1792400000.00,-0.000000001,0,0,1,0,1,0.000000002,0.000000003,64,Normal\n"
SOURCES = "^,*,metadata.google.internal,2,6,377,3,0.000000001,0.000000001,0.000000002\n"


class ProbeTest(unittest.TestCase):
    def test_csv_fields_and_units(self):
        self.assertEqual(tracking(TRACKING, SOURCES), {"system_offset_ns": "-1", "root_delay_ns": "2", "root_dispersion_ns": "3", "synchronised": True, "source_ok": True})

    def test_numeric_bounds_and_outward_rounding(self):
        self.assertEqual(nanos("0.0000000001"), "1")
        self.assertEqual(nanos("-0.0000000001", True), "-1")
        for value in ("NaN", "Infinity", "-1", "1e99999999", "1" * 65):
            with self.assertRaises(Exception):
                nanos(value)

    def test_unsynchronised_and_mixed_sources_are_not_trusted(self):
        self.assertFalse(tracking(TRACKING.replace("Normal", "Not synchronised"), SOURCES)["synchronised"])
        for sources in (SOURCES + SOURCES, SOURCES.replace("metadata.google.internal", "pool.ntp.org"), SOURCES.replace("^,*", "^,?")):
            self.assertFalse(tracking(TRACKING, sources)["source_ok"])
        self.assertFalse(tracking(TRACKING.replace("metadata.google.internal", "pool.ntp.org"), SOURCES)["source_ok"])

    def test_invalid_and_oversized_csv_fail_closed(self):
        for value in ("", "x" * 4097, TRACKING + TRACKING, "x,y,z\n"):
            with self.assertRaises(Exception):
                tracking(value, SOURCES)


if __name__ == "__main__":
    unittest.main()
