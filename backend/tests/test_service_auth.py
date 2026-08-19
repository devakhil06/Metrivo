import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.main import require_service_token


class ServiceAuthenticationTests(unittest.TestCase):
    def test_production_fails_closed_without_configuration(self):
        with patch.dict(os.environ, {"METRIVO_ENV": "production"}, clear=True):
            with self.assertRaises(HTTPException) as raised:
                require_service_token(None)
            self.assertEqual(raised.exception.status_code, 503)

    def test_configured_token_is_required_and_compared(self):
        env = {"METRIVO_ENV": "production", "ANALYTICS_SERVICE_TOKEN": "independent-test-token"}
        with patch.dict(os.environ, env, clear=True):
            with self.assertRaises(HTTPException) as raised:
                require_service_token("Bearer wrong-token")
            self.assertEqual(raised.exception.status_code, 401)
            self.assertIsNone(require_service_token("Bearer independent-test-token"))


if __name__ == "__main__":
    unittest.main()
