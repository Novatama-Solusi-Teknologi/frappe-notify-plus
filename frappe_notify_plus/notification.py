"""Override only the system-notification branch; core still evaluates rules."""
import json
import frappe
from frappe.email.doctype.notification.notification import Notification
from frappe.desk.doctype.notification_log.notification_log import enqueue_create_notification

class StyledNotification(Notification):
    def create_system_notification(self, doc, context):
        style = self.get("custom_notification_style")
        if not style or not frappe.db.get_value("Notification Style", style, "enabled"):
            return super().create_system_notification(doc, context)

        def render(value):
            return frappe.render_template(value, context) if value and "{" in value else value

        recipients, cc, bcc = self.get_list_of_recipients(doc, context)
        users = list(set(recipients + cc + bcc))
        if not users:
            return
        attachments = self.get_attachment(doc)
        payload = {
            "type": self.get("notification_type") or "Alert",
            "subject": render(self.subject),
            "email_content": render(self.message),
            "document_type": doc.parenttype if doc.meta.istable else doc.doctype,
            "document_name": doc.parent if doc.meta.istable else doc.name,
            "from_user": doc.modified_by or doc.owner,
            "attached_file": json.dumps(attachments) if attachments else None,
            "custom_notification_style": style,
            "custom_source_notification": self.name,
        }
        # Newer releases expose dedicated in-app fields; older v15 uses subject.
        meta = frappe.get_meta("Notification Log")
        for key, value in {
            "title": render(self.get("notification_title")) or payload["subject"],
            "description": render(self.get("notification_message")),
            "app": frappe.db.get_value("Module Def", self.module, "app_name") if self.get("module") else None,
        }.items():
            if meta.has_field(key):
                payload[key] = value
        # Resolve profiles only after the originating document transaction commits.
        frappe.enqueue(
            "frappe_notify_plus.notification.queue_log",
            users=users, payload=payload, enqueue_after_commit=True,
        )


def queue_log(users, payload):
    enqueue_create_notification(users, payload)
