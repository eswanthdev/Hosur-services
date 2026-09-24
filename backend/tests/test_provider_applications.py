import sqlite3
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.main import app
from hosur.api import get_store
from hosur.store import ApplicationError, Store


@pytest.fixture
def store(tmp_path):
    return Store(tmp_path / "applications.db")


@pytest.fixture
def client(store):
    app.dependency_overrides[get_store] = lambda: store
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def application(**overrides):
    return {
        "name": "  கார்த்திக்  ",
        "phone": "98765 43210",
        "serviceIds": ["plumber", "electrician"],
        "area": "  ஓசூர்  ",
        "language": "ta",
        "consent": True,
        **overrides,
    }


def manual_provider(**overrides):
    return {
        "id": "manual",
        "serviceId": "plumber",
        "name": "Existing professional",
        "phone": "+91 98765-43210",
        "rating": 4.8,
        "experience": "5 years",
        **overrides,
    }


def submit(client, **overrides):
    response = client.post("/api/provider-applications", json=application(**overrides))
    assert response.status_code == 201, response.text
    return response.json()


def review(client, receipt, action="approve"):
    return client.post(f"/api/provider-applications/{receipt['id']}/{action}")


def assert_utc(timestamp):
    assert datetime.fromisoformat(timestamp).utcoffset() == timedelta(0)


def test_multiservice_lifecycle_is_private_until_approved(client):
    before = client.get("/api/state").json()
    receipt = submit(client)
    assert set(receipt) == {"id", "status", "createdAt"}
    assert UUID(receipt["id"]).version == 4
    assert receipt["status"] == "pending"
    assert_utc(receipt["createdAt"])
    assert client.get("/api/state").json() == before
    pending = client.get("/api/provider-applications").json()
    expected = {
        **application(name="கார்த்திக்", area="ஓசூர்", phone="+919876543210"),
        **receipt, "experience": "", "reviewedAt": None,
    }
    assert pending == [expected]
    response = review(client, receipt)
    assert response.status_code == 200
    result = response.json()
    assert set(result) == {"application", "providers"}
    approved = result["application"]
    assert approved == {**expected, "status": "approved", "reviewedAt": approved["reviewedAt"]}
    assert_utc(approved["reviewedAt"])
    assert approved["reviewedAt"] >= approved["createdAt"]
    assert len(result["providers"]) == 2
    assert len({p["id"] for p in result["providers"]} | {receipt["id"]}) == 3
    for provider, service_id in zip(result["providers"], application()["serviceIds"]):
        assert UUID(provider["id"]).version == 4
        assert provider == {
            "id": provider["id"], "serviceId": service_id, "name": "கார்த்திக்",
            "phone": "+919876543210", "area": "ஓசூர்", "experience": "", "rating": None,
        }
    assert client.get("/api/provider-applications").json() == [approved]
    assert client.get("/api/state").json()["providerCatalog"] == {
        provider["serviceId"]: [provider] for provider in result["providers"]
    }
    assert review(client, receipt).status_code == 409
    assert review(client, receipt).json() == {"detail": "Provider application is already approved."}
    assert review(client, receipt, "reject").status_code == 409
    assert len(client.get("/api/state").json()["providerCatalog"]["plumber"]) == 1


def test_rejection_is_hidden_and_allows_reapplication(client):
    before = client.get("/api/state").json()
    receipt = submit(client, experience="10 ஆண்டுகள்")
    rejected = review(client, receipt, "reject")
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"
    assert rejected.json()["experience"] == "10 ஆண்டுகள்"
    assert_utc(rejected.json()["reviewedAt"])
    assert client.get("/api/provider-applications").json() == [rejected.json()]
    for action in ("approve", "reject"):
        response = review(client, receipt, action)
        assert response.status_code == 409
        assert response.json() == {"detail": "Provider application is already rejected."}
    replacement = submit(client)
    assert replacement["id"] != receipt["id"]
    assert client.get("/api/state").json() == before
    assert len(client.get("/api/provider-applications").json()) == 2


@pytest.mark.parametrize("action", ["approve", "reject"])
def test_missing_application(client, action):
    response = review(client, {"id": "missing"}, action)
    assert response.status_code == 404
    assert response.json() == {"detail": "Provider application not found."}


@pytest.mark.parametrize("phone", [
    "9876543210", "+919876543210", "919876543210",
    "  +91 98765-43210  ", "91-98765-43210",
])
def test_phone_normalization_and_pending_duplicate(client, phone):
    receipt = submit(client, phone=phone, serviceIds=["plumber"])
    assert client.get("/api/provider-applications").json()[0]["phone"] == "+919876543210"
    response = client.post("/api/provider-applications", json=application())
    assert response.status_code == 409
    assert "pending or approved" in response.json()["detail"]
    submit(client, serviceIds=["electrician"])
    assert review(client, receipt).status_code == 200


@pytest.mark.parametrize("phone", [
    "+91 98765-43210", "919876543210", "9876543210",
])
def test_existing_manual_provider_duplicate(client, phone):
    assert client.post("/api/providers", json=manual_provider(phone=phone)).status_code == 201
    response = client.post("/api/provider-applications", json=application())
    assert response.status_code == 409
    assert response.json() == {"detail": "A provider with this phone is already listed for a selected service."}
    submit(client, serviceIds=["electrician"])
    assert client.post("/api/providers", json=manual_provider(id="other", name="Other name")).status_code == 409


def test_approved_application_blocks_resubmission_even_if_provider_deleted(client):
    receipt = submit(client)
    approved = review(client, receipt).json()
    for provider in approved["providers"]:
        assert client.delete(f"/api/providers/{provider['id']}").status_code == 204
    response = client.post("/api/provider-applications", json=application())
    assert response.status_code == 409
    assert "pending or approved" in response.json()["detail"]


@pytest.mark.parametrize("field,value", [
    ("name", ""), ("name", "   "), ("name", "x" * 121), ("name", 123),
    ("area", ""), ("area", "\t"), ("area", "x" * 201),
    ("experience", "x" * 501), ("experience", None), ("experience", 1),
    ("phone", "5876543210"), ("phone", "987654321"), ("phone", "98765432100"),
    ("phone", "+449876543210"), ("phone", "00919876543210"), ("phone", "09876543210"),
    ("phone", "98765abc10"), ("phone", "９８７６５４３２１０"), ("phone", "98765\t43210"),
    ("phone", 9876543210), ("phone", "9" * 33),
    ("serviceIds", []), ("serviceIds", ["plumber", "plumber"]),
    ("serviceIds", ["plumber", " plumber "]), ("serviceIds", [""]), ("serviceIds", [123]),
    ("serviceIds", "plumber"), ("serviceIds", ["x" * 101]), ("serviceIds", ["plumber"] * 11),
    ("serviceIds", ["does-not-exist"]),
    ("language", "hi"), ("language", "EN"), ("consent", False),
    ("consent", "true"), ("consent", 1), ("consent", None),
    ("status", "approved"), ("rating", 5), ("id", "client-id"),
    ("createdAt", "2026-01-01T00:00:00Z"), ("reviewedAt", None),
])
def test_invalid_payload_rejected_without_queue_entry(client, field, value):
    response = client.post("/api/provider-applications", json=application(**{field: value}))
    assert response.status_code == 422, response.text
    assert client.get("/api/provider-applications").json() == []
    assert client.get("/api/state").json()["providerCatalog"] == {}


@pytest.mark.parametrize("field", ["name", "phone", "serviceIds", "area", "language", "consent"])
def test_required_fields(client, field):
    payload = application()
    del payload[field]
    assert client.post("/api/provider-applications", json=payload).status_code == 422


@pytest.mark.parametrize("language,name,area", [
    ("en", "Local professional", "Hosur"), ("ta", "குமார்", "ஓசூர்"),
    ("te", "కుమార్", "హోసూర్"), ("kn", "ಕುಮಾರ್", "ಹೊಸೂರು"),
])
def test_languages_and_unicode(client, language, name, area):
    submit(client, language=language, name=name, area=area, experience="")
    queued = client.get("/api/provider-applications").json()[0]
    assert (queued["language"], queued["name"], queued["area"]) == (language, name, area)


def test_ten_distinct_services_supported(client):
    services = [s["id"] for s in client.get("/api/state").json()["services"][:10]]
    receipt = submit(client, serviceIds=services)
    assert len(review(client, receipt).json()["providers"]) == 10


def test_approval_checks_deleted_service_and_keeps_pending(client, store):
    receipt = submit(client)
    with sqlite3.connect(store.db_path) as conn:
        conn.execute("DELETE FROM services WHERE id = 'electrician'")
    response = review(client, receipt)
    assert response.status_code == 409
    assert response.json() == {"detail": "Cannot approve: one or more selected services no longer exist."}
    assert client.get("/api/state").json()["providerCatalog"] == {}
    queued = client.get("/api/provider-applications").json()[0]
    assert queued["status"] == "pending" and queued["reviewedAt"] is None


def test_approval_checks_provider_added_after_submission(client):
    receipt = submit(client)
    assert client.post("/api/providers", json=manual_provider(serviceId="electrician")).status_code == 201
    response = review(client, receipt)
    assert response.status_code == 409
    assert response.json() == {"detail": "Cannot approve: a provider with this phone is already listed for a selected service."}
    assert "plumber" not in client.get("/api/state").json()["providerCatalog"]
    assert client.get("/api/provider-applications").json()[0]["status"] == "pending"


def test_partial_provider_insertion_rolls_back_on_error(client, store):
    receipt = submit(client)
    with sqlite3.connect(store.db_path) as conn:
        conn.execute(
            "CREATE TRIGGER fail_second_provider BEFORE INSERT ON providers"
            " WHEN NEW.service_id = 'electrician' BEGIN SELECT RAISE(ABORT, 'test failure'); END"
        )
    response = review(client, receipt)
    assert response.status_code == 409
    assert response.json() == {"detail": "Cannot approve: provider creation failed; no changes were saved."}
    reopened = Store(store.db_path)
    assert reopened.get_state()["providerCatalog"] == {}
    queued = reopened.get_provider_applications()[0]
    assert queued["status"] == "pending" and queued["reviewedAt"] is None
    with sqlite3.connect(store.db_path) as conn:
        conn.execute("DROP TRIGGER fail_second_provider")
    assert review(client, receipt).status_code == 200


def test_additive_schema_preserves_existing_database_and_queue_states(tmp_path):
    path = tmp_path / "legacy.db"
    with sqlite3.connect(path) as conn:
        conn.executescript(
            "CREATE TABLE services (id TEXT PRIMARY KEY, name TEXT NOT NULL, tamil TEXT NOT NULL, category TEXT NOT NULL);"
            "INSERT INTO services VALUES ('plumber', 'Existing', 'Existing', 'Home');"
            "CREATE TABLE providers (id TEXT PRIMARY KEY, service_id TEXT NOT NULL, name TEXT NOT NULL,"
            "phone TEXT NOT NULL, rating REAL NOT NULL, experience TEXT NOT NULL, area TEXT);"
            "INSERT INTO providers VALUES ('legacy', 'plumber', 'Legacy', 'landline', 4.7, '20 years', 'Hosur');"
        )
    store = Store(path)
    before = store.get_state()
    receipts = []
    for phone in ("9876543210", "8876543210", "7876543210"):
        receipts.append(store.add_provider_application(application(
            phone=phone, serviceIds=["plumber"], experience=""
        )))
    store.approve_provider_application(receipts[0]["id"])
    store.reject_provider_application(receipts[1]["id"])
    reopened = Store(path)
    assert reopened.get_state() == store.get_state()
    assert reopened.get_state()["services"] == before["services"]
    assert reopened.get_state()["providerCatalog"]["plumber"][0] == before["providerCatalog"]["plumber"][0]
    assert reopened.get_provider_applications() == store.get_provider_applications()
    assert {a["status"] for a in reopened.get_provider_applications()} == {"approved", "rejected", "pending"}


def test_review_averages_replace_unrated_and_legacy_ratings(client):
    receipt = submit(client, serviceIds=["plumber"])
    provider = review(client, receipt).json()["providers"][0]
    assert provider["rating"] is None
    assert client.post("/api/providers", json=manual_provider(phone="8876543210")).status_code == 201
    for provider_id in (provider["id"], "manual"):
        for index, rating in enumerate((2, 5)):
            response = client.post("/api/reviews", json={
                "id": f"{provider_id}-{index}", "providerId": provider_id,
                "userName": "Reviewer", "rating": rating, "comment": "Actual experience",
            })
            assert response.status_code == 201
        assert client.patch(f"/api/providers/{provider_id}", json={"area": "Hosur"}).json()["rating"] == 3.5
    assert [p["rating"] for p in client.get("/api/state").json()["providerCatalog"]["plumber"]] == [3.5, 3.5]


@pytest.mark.parametrize("omit_rating", [False, True])
def test_manual_provider_can_be_unrated(client, store, omit_rating):
    payload = manual_provider(rating=None)
    if omit_rating:
        del payload["rating"]
    response = client.post("/api/providers", json=payload)
    assert response.status_code == 201
    assert response.json()["rating"] is None
    assert client.get("/api/state").json()["providerCatalog"]["plumber"][0]["rating"] is None
    with sqlite3.connect(store.db_path) as conn:
        assert conn.execute("SELECT rating FROM providers WHERE id = 'manual'").fetchone()[0] == 0
    assert client.post("/api/reviews", json={
        "id": "manual-review", "providerId": "manual", "userName": "Reviewer",
        "rating": 4, "comment": "Actual experience",
    }).status_code == 201
    assert client.get("/api/state").json()["providerCatalog"]["plumber"][0]["rating"] == 4


def test_unknown_service_returns_string_detail(client):
    response = client.post("/api/provider-applications", json=application(serviceIds=["unknown"]))
    assert response.status_code == 422
    assert response.json() == {"detail": "One or more selected services do not exist."}


def test_concurrent_submissions_and_approvals_are_serialized(store):
    payload = application(experience="")

    def submit_once(_):
        try:
            return Store(store.db_path).add_provider_application(payload)
        except ApplicationError as exc:
            return exc.status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        submissions = list(pool.map(submit_once, range(2)))
    assert submissions.count(409) == 1
    receipt = next(result for result in submissions if isinstance(result, dict))

    def approve_once(_):
        try:
            return Store(store.db_path).approve_provider_application(receipt["id"])
        except ApplicationError as exc:
            return exc.status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        approvals = list(pool.map(approve_once, range(2)))
    assert approvals.count(409) == 1
    assert sum(len(providers) for providers in store.get_state()["providerCatalog"].values()) == 2
