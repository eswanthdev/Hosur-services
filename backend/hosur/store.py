"""SQLite persistence for Hosur Services.

Each method opens its own connection so the store is safe to share across
FastAPI's worker threads. Lists come back in the order the frontend shows
them: catalogue items oldest-first, news/feed/reviews newest-first.
"""

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

SEED_PATH = Path(__file__).with_name("seed_data.json")

SCHEMA = """
CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tamil TEXT NOT NULL,
    category TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    rating REAL NOT NULL,
    experience TEXT NOT NULL,
    area TEXT
);
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    rating REAL NOT NULL,
    comment TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS news_items (
    id TEXT PRIMARY KEY,
    badge TEXT NOT NULL,
    area TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS feed_posts (
    id TEXT PRIMARY KEY,
    author TEXT NOT NULL,
    handle TEXT NOT NULL,
    location TEXT NOT NULL,
    title TEXT NOT NULL,
    caption TEXT NOT NULL,
    accent TEXT NOT NULL,
    tag TEXT NOT NULL,
    likes INTEGER NOT NULL DEFAULT 0,
    comments INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS post_likes (
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    PRIMARY KEY (post_id, user_id)
);
CREATE TABLE IF NOT EXISTS asked_for (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Store:
    def __init__(self, db_path: str | Path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.executescript(SCHEMA)
            if conn.execute("SELECT COUNT(*) FROM services").fetchone()[0] == 0:
                self._seed(conn)

    @contextmanager
    def _connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            with conn:
                yield conn
        finally:
            conn.close()

    def _seed(self, conn: sqlite3.Connection) -> None:
        seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))
        conn.executemany(
            "INSERT INTO services (id, name, tamil, category) VALUES (:id, :name, :tamil, :category)",
            seed["services"],
        )
        # News and feed are listed newest-first, so insert the seed in reverse.
        conn.executemany(
            "INSERT INTO news_items (id, badge, area, title, summary) VALUES (:id, :badge, :area, :title, :summary)",
            list(reversed(seed["newsItems"])),
        )
        created_at = _now()
        conn.executemany(
            "INSERT INTO feed_posts (id, author, handle, location, title, caption, accent, tag, likes, comments, created_at)"
            " VALUES (:id, :author, :handle, :location, :title, :caption, :accent, :tag, :likes, :comments, :created_at)",
            [{**post, "created_at": created_at} for post in reversed(seed["feedPosts"])],
        )

    # ---- reads -------------------------------------------------------------

    def get_state(self) -> dict:
        with self._connect() as conn:
            services = [dict(row) for row in conn.execute("SELECT id, name, tamil, category FROM services ORDER BY rowid")]

            provider_catalog: dict[str, list[dict]] = {}
            for row in conn.execute("SELECT * FROM providers ORDER BY rowid"):
                provider = self._provider(row)
                provider_catalog.setdefault(provider["serviceId"], []).append(provider)

            reviews_by_provider: dict[str, list[dict]] = {}
            for row in conn.execute("SELECT * FROM reviews ORDER BY rowid DESC"):
                review = self._review(row)
                reviews_by_provider.setdefault(review["providerId"], []).append(review)

            news_items = [dict(row) for row in conn.execute("SELECT id, badge, area, title, summary FROM news_items ORDER BY rowid DESC")]
            feed_posts = [self._post(conn, row) for row in conn.execute("SELECT * FROM feed_posts ORDER BY rowid DESC")]
            asked_for = [row[0] for row in conn.execute("SELECT query FROM asked_for ORDER BY id")]

        return {
            "services": services,
            "providerCatalog": provider_catalog,
            "reviewsByProvider": reviews_by_provider,
            "newsItems": news_items,
            "feedPosts": feed_posts,
            "askedFor": asked_for,
        }

    @staticmethod
    def _provider(row: sqlite3.Row) -> dict:
        provider = {
            "id": row["id"],
            "name": row["name"],
            "phone": row["phone"],
            "rating": row["rating"],
            "experience": row["experience"],
            "serviceId": row["service_id"],
        }
        if row["area"]:
            provider["area"] = row["area"]
        return provider

    @staticmethod
    def _review(row: sqlite3.Row) -> dict:
        return {
            "id": row["id"],
            "providerId": row["provider_id"],
            "userName": row["user_name"],
            "rating": row["rating"],
            "comment": row["comment"],
            "createdAt": row["created_at"],
        }

    @staticmethod
    def _post(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
        liked_by = [r[0] for r in conn.execute("SELECT user_id FROM post_likes WHERE post_id = ? ORDER BY rowid", (row["id"],))]
        return {
            "id": row["id"],
            "author": row["author"],
            "handle": row["handle"],
            "location": row["location"],
            "title": row["title"],
            "caption": row["caption"],
            "accent": row["accent"],
            "tag": row["tag"],
            "likes": row["likes"],
            "likedBy": liked_by,
            "comments": row["comments"],
            "createdAt": row["created_at"],
        }

    # ---- writes ------------------------------------------------------------
    # Each write returns None when the change conflicts with existing data
    # (duplicate id, missing parent) so the API can map it to an HTTP error.

    def add_service(self, service: dict) -> dict | None:
        with self._connect() as conn:
            try:
                conn.execute("INSERT INTO services (id, name, tamil, category) VALUES (:id, :name, :tamil, :category)", service)
            except sqlite3.IntegrityError:
                return None
        return service

    def add_provider(self, provider: dict) -> dict | None:
        with self._connect() as conn:
            if not conn.execute("SELECT 1 FROM services WHERE id = ?", (provider["serviceId"],)).fetchone():
                return None
            duplicate = conn.execute(
                "SELECT 1 FROM providers WHERE id = ? OR (service_id = ? AND lower(name) = lower(?))",
                (provider["id"], provider["serviceId"], provider["name"]),
            ).fetchone()
            if duplicate:
                return None
            conn.execute(
                "INSERT INTO providers (id, service_id, name, phone, rating, experience, area) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (provider["id"], provider["serviceId"], provider["name"], provider["phone"], provider["rating"], provider["experience"], provider.get("area")),
            )
            return self._provider(conn.execute("SELECT * FROM providers WHERE id = ?", (provider["id"],)).fetchone())

    def update_provider_area(self, provider_id: str, area: str | None) -> dict | None:
        with self._connect() as conn:
            conn.execute("UPDATE providers SET area = ? WHERE id = ?", (area or None, provider_id))
            row = conn.execute("SELECT * FROM providers WHERE id = ?", (provider_id,)).fetchone()
            return self._provider(row) if row else None

    def delete_provider(self, provider_id: str) -> bool:
        with self._connect() as conn:
            return conn.execute("DELETE FROM providers WHERE id = ?", (provider_id,)).rowcount > 0

    def add_review(self, review: dict) -> dict | None:
        with self._connect() as conn:
            if not conn.execute("SELECT 1 FROM providers WHERE id = ?", (review["providerId"],)).fetchone():
                return None
            try:
                conn.execute(
                    "INSERT INTO reviews (id, provider_id, user_name, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (review["id"], review["providerId"], review["userName"], review["rating"], review["comment"], review.get("createdAt") or _now()),
                )
            except sqlite3.IntegrityError:
                return None
            return self._review(conn.execute("SELECT * FROM reviews WHERE id = ?", (review["id"],)).fetchone())

    def add_news_item(self, item: dict) -> dict | None:
        with self._connect() as conn:
            try:
                conn.execute("INSERT INTO news_items (id, badge, area, title, summary) VALUES (:id, :badge, :area, :title, :summary)", item)
            except sqlite3.IntegrityError:
                return None
        return item

    def add_feed_post(self, post: dict) -> dict | None:
        with self._connect() as conn:
            try:
                conn.execute(
                    "INSERT INTO feed_posts (id, author, handle, location, title, caption, accent, tag, likes, comments, created_at)"
                    " VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)",
                    (post["id"], post["author"], post["handle"], post["location"], post["title"], post["caption"], post["accent"], post["tag"], post.get("createdAt") or _now()),
                )
            except sqlite3.IntegrityError:
                return None
            return self._post(conn, conn.execute("SELECT * FROM feed_posts WHERE id = ?", (post["id"],)).fetchone())

    def like_post(self, post_id: str, user_id: str) -> dict | None:
        """Records one like per user; liking twice leaves the count unchanged."""
        with self._connect() as conn:
            if not conn.execute("SELECT 1 FROM feed_posts WHERE id = ?", (post_id,)).fetchone():
                return None
            inserted = conn.execute("INSERT OR IGNORE INTO post_likes (post_id, user_id) VALUES (?, ?)", (post_id, user_id)).rowcount
            if inserted:
                conn.execute("UPDATE feed_posts SET likes = likes + 1 WHERE id = ?", (post_id,))
            return self._post(conn, conn.execute("SELECT * FROM feed_posts WHERE id = ?", (post_id,)).fetchone())

    def add_asked_for(self, query: str) -> list[str]:
        with self._connect() as conn:
            conn.execute("INSERT INTO asked_for (query, created_at) VALUES (?, ?)", (query, _now()))
            return [row[0] for row in conn.execute("SELECT query FROM asked_for ORDER BY id")]
