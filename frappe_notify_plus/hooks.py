app_name = "frappe_notify_plus"
app_title = "Notify Plus"
app_publisher = "Notify Plus Contributors"
app_description = "Custom notification toasts and sounds"
app_email = ""
app_license = "MIT"
app_include_js = ["/assets/frappe_notify_plus/js/notify_plus.js?v=0.1.2"]
app_include_css = ["/assets/frappe_notify_plus/css/notify_plus.css"]
doctype_js = {"Notification": "public/js/notification.js"}
after_install = "frappe_notify_plus.install.setup"
after_migrate = "frappe_notify_plus.install.setup"
before_uninstall = "frappe_notify_plus.install.cleanup"
override_doctype_class = {
    "Notification": "frappe_notify_plus.notification.StyledNotification"
}
doc_events = {
    "Notification Log": {"after_insert": "frappe_notify_plus.events.deliver"}
}
