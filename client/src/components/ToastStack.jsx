import Icon from "./Icon.jsx";

export default function ToastStack({ toasts }) {
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div className={`toast toast-${toast.type || "info"}`} key={toast.id} role={toast.type === "error" ? "alert" : "status"}>
          <Icon name={toast.type === "error" ? "warning" : toast.type === "success" ? "check" : "info"} size={15} />
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
