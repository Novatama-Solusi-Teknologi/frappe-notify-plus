frappe.ui.form.on("Notification", {
    refresh(frm) {
        if (frm.doc.custom_notification_style) {
            frm.add_custom_button(__("Open Notification Style"), () =>
                frappe.set_route("Form", "Notification Style", frm.doc.custom_notification_style));
        }
    }
});
