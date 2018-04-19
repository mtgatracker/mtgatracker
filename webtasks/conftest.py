import pytest


def pytest_addoption(parser):
    parser.addoption("--local", action="store_true", default=False, help="use a local webtask server")


@pytest.fixture
def is_local(request):
    return request.config.getoption("--local")