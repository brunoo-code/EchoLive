import { useCallback, useState } from "react";

let toastId = 0;

function getToastType(message) {
  if (/erro|falha|nao foi|negada|excede|indisponivel|perdida|invalido/i.test(message)) return "error";
  if (/copiado|salvo|aplicado|atualizado|ligado|iniciado/i.test(message)) return "success";
  return "info";
}

export default function useToasts() {
  const [toasts, setToasts] = useState([]);

  const notify = useCallback((message) => {
    const id = toastId += 1;
    setToasts((current) => {
      if (current.some((toast) => toast.message === message)) {
        return current;
      }

      return [...current, { id, message, type: getToastType(message) }].slice(-3);
    });
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 2400);
  }, []);

  return { toasts, notify };
}
