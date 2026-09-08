frappe.ui.form.on("Notification Style", {
    refresh(frm) {
        frm.add_custom_button(__("Preview Toast & Sound"), () => {
            frappe.notify_plus.preview({...frm.doc,
                title: __("Example notification"),
                message: __("Your document is ready for review.")
            });
        });
    }
});
