import unittest
from scripts.update import discover, normalize_date


class DiscoverTests(unittest.TestCase):
    def setUp(self):
        self.source = {"id":"demo","name":"测试人社","region":"测试","url":"https://rsj.example.gov.cn/list/","host":"rsj.example.gov.cn"}

    def test_filters_and_date(self):
        html = '''<ul><li><a href="/notice/1.html">某市幼儿园2026年教师招聘公告</a> 2026-09-30</li>
        <li><a href="https://evil.example/notice">某校教师招聘公告</a> 2026-09-29</li>
        <li><a href="/notice/2.html">某单位公务员考试公告</a> 2026-09-28</li></ul>'''
        rows = discover(self.source, html)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["published"], "2026-09-30")
        self.assertEqual(rows[0]["url"], "https://rsj.example.gov.cn/notice/1.html")

    def test_invalid_date_is_missing(self):
        self.assertIsNone(normalize_date("2026-13-45"))


if __name__ == "__main__":
    unittest.main()
