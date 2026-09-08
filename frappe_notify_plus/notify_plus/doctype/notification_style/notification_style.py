import frappe
from frappe.model.document import Document
from frappe_notify_plus.validation import validate_config

class NotificationStyle(Document):
    def validate(self):
        try:
            validate_config(self.as_dict())
        except (ValueError, TypeError) as error:
            frappe.throw(str(error))
        if self.sound == "Custom":
            file = frappe.db.get_value("File", {"file_url": self.custom_sound, "is_private": 0}, ["name", "file_size"], as_dict=True)
            if not file or not 0 < (file.file_size or 0) <= 2 * 1024 * 1024:
                frappe.throw("Upload a public audio file with a size of 1 byte to 2 MB.")
