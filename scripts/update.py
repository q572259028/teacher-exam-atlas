#!/usr/bin/env python3
"""Discover official notice links. Run hourly in GitHub Actions; no third-party packages."""
from __future__ import annotations

import json
import re
import ssl
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "data/sources.json"
CURATED = ROOT / "data/curated.json"
OUTPUT = ROOT / "data/publications.json"
DATE = re.compile(r"20\d{2}[-./年]\d{1,2}[-./月]\d{1,2}")
EDUCATION = re.compile(r"教师|教育|幼儿园|师范|学校|学院|大学|辅导员|教委")
RECRUITMENT = re.compile(r"招聘|选聘|招录|招考|人才引进")
SKIP = re.compile(r"公务员|军队文职|三支一扶|特岗教师|志愿者|拟聘|公示|面试公告|成绩|体检|资格复审")


class Links(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.href = None
        self.words = []
        self.tail = ""

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.href = dict(attrs).get("href")
            self.words = []

    def handle_data(self, data):
        if self.href is not None:
            self.words.append(data)
        elif self.links:
            self.links[-1][2].append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self.href is not None:
            title = " ".join("".join(self.words).split())
            self.links.append([self.href, title, []])
            self.href = None


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "TeacherExamAtlas/1.0 (+public official notices)", "Accept": "text/html"})
    with urllib.request.urlopen(request, timeout=18, context=ssl.create_default_context()) as response:
        body = response.read(3_000_000)
        charset = response.headers.get_content_charset()
    if not charset:
        match = re.search(rb"charset\s*=\s*['\"]?([A-Za-z0-9_-]+)", body[:4096], re.I)
        charset = match.group(1).decode("ascii") if match else "utf-8"
    return body.decode(charset, errors="replace")


def normalize_date(text: str):
    found = DATE.search(text)
    if not found:
        return None
    parts = re.findall(r"\d+", found.group())
    year, month, day = map(int, parts)
    try:
        return f"{year:04d}-{month:02d}-{day:02d}" if datetime(year, month, day) else None
    except ValueError:
        return None


def discover(source, html):
    parser = Links()
    parser.feed(html)
    found = []
    for href, title, tail in parser.links:
        if not (EDUCATION.search(title) and RECRUITMENT.search(title)) or SKIP.search(title):
            continue
        url = urllib.parse.urljoin(source["url"], href)
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != "https" or parsed.hostname != source["host"]:
            continue
        date = normalize_date(" ".join(tail[:8]))
        found.append({"id": "link-" + source["id"] + "-" + re.sub(r"[^a-zA-Z0-9]", "", parsed.path)[-40:],
                      "title": title, "region": source["region"], "city": None, "sourceId": source["id"],
                      "published": date, "url": url, "kind": "官方链接·待核详情", "school": None,
                      "positions": None, "plannedHires": None, "applyWindow": None, "examTime": None,
                      "examVenue": None, "workplace": None, "qualifications": None, "subjects": None,
                      "status": "需核对原文", "verified": None,
                      "notes": "自动发现的官方链接；岗位、编制属性、考试信息与报名状态尚未人工核对。"})
    return found


def main():
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    sources = json.loads(SOURCES.read_text(encoding="utf-8"))
    curated = json.loads(CURATED.read_text(encoding="utf-8"))
    old = json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else {}
    source_ids = {source["id"] for source in sources}
    previous = {item["url"]: item for item in old.get("discovered", []) if item.get("sourceId") in source_ids}
    health = {}
    for source in sources:
        try:
            fresh = discover(source, fetch(source["url"]))
            for item in fresh:
                prior = previous.get(item["url"])
                item["firstSeen"] = prior.get("firstSeen", now) if prior else now
                item["lastSeen"] = now
                previous[item["url"]] = item
            health[source["id"]] = {"ok": True, "checkedAt": now, "linksFound": len(fresh)}
        except Exception as error:
            health[source["id"]] = {"ok": False, "checkedAt": now, "error": str(error)[:180]}
            print(f"{source['id']}: {error}", file=sys.stderr)
    curated_urls = {item["url"] for item in curated["notices"]}
    discovered = [item for item in previous.values() if item["url"] not in curated_urls]
    discovered.sort(key=lambda x: (x.get("published") or "", x.get("lastSeen") or ""), reverse=True)
    result = {"generatedAt": now, "sources": sources, "health": health,
              "notices": curated["notices"], "discovered": discovered[:400],
              "history": curated["history"], "plans": curated["plans"]}
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Updated: {len(curated['notices'])} verified, {len(result['discovered'])} discovered")
    return 0 if any(row["ok"] for row in health.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
