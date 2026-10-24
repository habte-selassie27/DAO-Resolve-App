"""Direct tests for the proposal registry read path.

`list_proposals` had no coverage at all, and on StudioNet every call returned
`KeyError` from inside the contract: the view paged `self.proposals`, a
`TreeMap[str, ProposalRecord]`, with an integer slice, so the map lookup got a
`slice` instead of a string key. `list_disputes` and `list_rules` page their
`DynArray` id lists instead, which is why only this one view broke.

These tests exercise the read path the frontend depends on: an empty registry,
registration order, bounded paging, and the event count.
"""

import pytest

from conftest import add_proposal


def test_list_proposals_is_empty_before_registration(dao):
    assert dao.list_proposals(0, 50) == []


def test_list_proposals_returns_registration_order(dao):
    add_proposal(dao, "P1", "ipfs://one")
    add_proposal(dao, "P2", "ipfs://two")
    add_proposal(dao, "P3", "ipfs://three")

    listed = dao.list_proposals(0, 50)

    assert [item["proposal_id"] for item in listed] == ["P1", "P2", "P3"]
    assert [item["content_ref"] for item in listed] == [
        "ipfs://one",
        "ipfs://two",
        "ipfs://three",
    ]
    assert listed[0]["status_note"] == "recorded for test"
    assert listed[0]["event_count"] == 0
    assert listed[0]["created_at"] > 0
    assert listed[0]["created_by"]


def test_list_proposals_pages_without_reordering(dao):
    for index in range(1, 6):
        add_proposal(dao, "P" + str(index), "ipfs://" + str(index))

    assert [item["proposal_id"] for item in dao.list_proposals(0, 2)] == ["P1", "P2"]
    assert [item["proposal_id"] for item in dao.list_proposals(2, 2)] == ["P3", "P4"]
    assert [item["proposal_id"] for item in dao.list_proposals(4, 2)] == ["P5"]
    assert dao.list_proposals(10, 2) == []


def test_list_proposals_rejects_out_of_range_page_size(dao):
    with pytest.raises(Exception, match="EXPECTED: invalid page size"):
        dao.list_proposals(0, 0)

    with pytest.raises(Exception, match="EXPECTED: invalid page size"):
        dao.list_proposals(0, 51)


def test_list_proposals_counts_events_for_each_proposal(dao, alice):
    add_proposal(dao, "P1", "ipfs://one")
    add_proposal(dao, "P2", "ipfs://two")

    dao.record_process_event("P1", "e1", "SUBMITTED", alice, 1000, "doc://proposal")
    dao.record_process_event("P1", "e2", "VOTING_STARTED", alice, 1100, "")

    counts = {item["proposal_id"]: item["event_count"] for item in dao.list_proposals(0, 50)}

    assert counts == {"P1": 2, "P2": 0}


def test_list_proposals_matches_get_proposal(dao):
    add_proposal(dao, "P1", "ipfs://one")

    listed = dao.list_proposals(0, 1)[0]
    single = dao.get_proposal("P1")

    assert listed == single
