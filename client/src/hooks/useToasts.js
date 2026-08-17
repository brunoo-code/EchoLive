import { useCallback, useState } from "react";

let toastId = 0;

export default function useToasts() {
  const [toasts, setToasts] = useState([]);

  const notify = useCallback((message) => {
    const id = toastId += 1;
    setToasts((current) => {
      if (current.some((toast) => toast.message === message)) {
        return current;
      }

      return [...current, { id, message }];
    });
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  }, []);

  return { toasts, notify };
}
