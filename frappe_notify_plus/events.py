import frappe
from frappe.utils import strip_html


def deliver(doc, method=None):
    style_name = doc.get("custom_notification_style")
    if not style_name or not doc.get("for_user") or doc.for_user == "Guest":
        return
    try:
        style = frappe.get_doc("Notification Style", style_name)
        if not style.enabled:
            return
        payload = {key: style.get(key) for key in (
            "toast_style", "tone", "position", "duration", "sound", "custom_sound", "volume"
        )}
        payload.update({
            "id": doc.name,
            "document_type": doc.get("document_type"),
            "document_name": doc.get("document_name"),
            "title": strip_html(doc.get("title") or doc.get("subject") or "Notification")[:240],
            "message": strip_html(doc.get("description") or doc.get("email_content") or "")[:600],
        })
        # The existing Notification Log controls which user receives the event.
        # Record access remains enforced by Frappe when the recipient opens it.
        frappe.publish_realtime("notify_plus", payload, user=doc.for_user, after_commit=True)
    except Exception:
        # Presentation failure must not prevent saving a core notification.
        frappe.log_error(title="Notify Plus delivery failed", message=frappe.get_traceback())
