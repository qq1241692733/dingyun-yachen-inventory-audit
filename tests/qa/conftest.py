import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from qa_support import api as _api


@pytest.fixture(scope="session")
def api():
    return _api


def pytest_configure(config):
    config.addinivalue_line("markers", "p0: A 级铁律（恒定验证）")
    config.addinivalue_line("markers", "impact: 影响面回归")
    config.addinivalue_line("markers", "deep: 深度探索")
