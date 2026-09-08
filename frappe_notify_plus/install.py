import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

FIELDS = {
    "Notification": [
        {"fieldname": "custom_notify_plus_section", "label": "Notify Plus", "fieldtype": "Section Break", "insert_after": "message"},
        {"fieldname": "custom_notification_style", "label": "Notification Style", "fieldtype": "Link", "options": "Notification Style", "insert_after": "custom_notify_plus_section", "description": "Used for System Notification, or when Send System Notification is enabled."},
    ],
    "Notification Log": [
        {"fieldname": "custom_notification_style", "label": "Notification Style", "fieldtype": "Link", "options": "Notification Style", "read_only": 1, "hidden": 1},
        {"fieldname": "custom_source_notification", "label": "Source Notification", "fieldtype": "Data", "read_only": 1, "hidden": 1},
    ],
}

def setup():
    create_custom_fields(FIELDS, update=True)


def cleanup():
    for dt, fields in FIELDS.items():
        for field in fields:
            name = f"{dt}-{field['fieldname']}"
            if frappe.db.exists("Custom Field", name):
                frappe.delete_doc("Custom Field", name, ignore_permissions=True)
