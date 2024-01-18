import pytest

from cat.looking_glass.stray_cat import StrayCat
from cat.memory.working_memory import WorkingMemory


@pytest.fixture
def stray(client):
    yield StrayCat(user_id="Alice")


def test_stray_initialization(stray):

    assert isinstance(stray, StrayCat)
    assert stray.user_id == "Alice"
    assert isinstance(stray.working_memory, WorkingMemory)


# TODO: test all properties and methods