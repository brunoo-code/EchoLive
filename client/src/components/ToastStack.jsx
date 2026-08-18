import Icon from "./Icon.jsx";

export default function ToastStack({ toasts }) {
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div className="toast" key={toast.id}>
          <Icon name="check" size={15} />
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
