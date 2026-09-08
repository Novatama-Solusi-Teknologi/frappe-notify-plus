"""Contract tests without a running Frappe site; real-site checklist is in README."""
import importlib.util
from pathlib import Path
import sys
import unittest
from types import ModuleType, SimpleNamespace
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1] / "frappe_notify_plus"


def load(name, file, modules):
    with patch.dict(sys.modules, modules):
        spec = importlib.util.spec_from_file_location(name, ROOT / file)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module


class BaseNotification(dict):
    def __getattr__(self, key):
        return self.get(key)

    def create_system_notification(self, doc, context):
        return "core-fallback"

    def get_list_of_recipients(self, doc, context):
        return ["a@test.com"], ["a@test.com"], ["b@test.com"]

    def get_attachment(self, doc):
        return []


class DeliveryTests(unittest.TestCase):
    def setUp(self):
        self.frappe = ModuleType("frappe")
        self.frappe.db = SimpleNamespace(get_value=Mock(return_value=1))
        self.frappe.enqueue = Mock()
        self.frappe.get_meta = Mock(return_value=SimpleNamespace(has_field=lambda key: True))
        self.frappe.render_template = Mock(return_value="Rendered")
        self.frappe.publish_realtime = Mock()
        self.frappe.log_error = Mock()
        self.frappe.get_traceback = Mock(return_value="error")
        core = ModuleType("frappe.email.doctype.notification.notification")
        core.Notification = BaseNotification
        log = ModuleType("frappe.desk.doctype.notification_log.notification_log")
        log.enqueue_create_notification = Mock()
        self.module = load("subject_notification", "notification.py", {
            "frappe": self.frappe, core.__name__: core, log.__name__: log,
        })

    def rule(self, **overrides):
        values = dict(name="Approval", custom_notification_style="Important", subject="{{ doc.name }}", message="Body")
        values.update(overrides)
        return self.module.StyledNotification(values)

    def document(self):
        return SimpleNamespace(meta=SimpleNamespace(istable=False), doctype="ToDo", name="TODO-1", modified_by="author@test.com", owner="author@test.com")

    def test_queue_preserves_rule_and_recipients_after_commit(self):
        self.rule().create_system_notification(self.document(), {})
        kwargs = self.frappe.enqueue.call_args.kwargs
        self.assertTrue(kwargs["enqueue_after_commit"])
        self.assertEqual(set(kwargs["users"]), {"a@test.com", "b@test.com"})
        self.assertEqual(kwargs["payload"]["custom_source_notification"], "Approval")
        self.assertEqual(kwargs["payload"]["custom_notification_style"], "Important")
        self.assertEqual(kwargs["payload"]["subject"], "Rendered")

    def test_unconfigured_and_disabled_use_core(self):
        self.assertEqual(self.rule(custom_notification_style=None).create_system_notification(self.document(), {}), "core-fallback")
        self.frappe.db.get_value.return_value = 0
        self.assertEqual(self.rule().create_system_notification(self.document(), {}), "core-fallback")
        self.frappe.enqueue.assert_not_called()

    def test_no_recipients_does_not_queue(self):
        with patch.object(self.module.StyledNotification, "get_list_of_recipients", return_value=([], [], [])):
            self.rule().create_system_notification(self.document(), {})
        self.frappe.enqueue.assert_not_called()

    def test_realtime_is_private_and_after_commit(self):
        utils = ModuleType("frappe.utils")
        utils.strip_html = lambda value: value.replace("<b>", "").replace("</b>", "")
        events = load("subject_events", "events.py", {"frappe": self.frappe, "frappe.utils": utils})
        profile = BaseNotification(enabled=1, toast_style="Accent", sound="Chime")
        self.frappe.get_doc = Mock(return_value=profile)
        doc = BaseNotification(name="LOG-1", for_user="a@test.com", custom_notification_style="Important", subject="<b>Hello</b>")
        events.deliver(doc)
        args, kwargs = self.frappe.publish_realtime.call_args
        self.assertEqual(args[0], "notify_plus")
        self.assertEqual(args[1]["title"], "Hello")
        self.assertEqual(kwargs, {"user": "a@test.com", "after_commit": True})
        self.frappe.publish_realtime.reset_mock()
        events.deliver(BaseNotification(for_user="Guest", custom_notification_style="Important"))
        events.deliver(BaseNotification(for_user="a@test.com"))
        self.frappe.publish_realtime.assert_not_called()


if __name__ == "__main__":
    unittest.main()
