// src/hooks/useAlerts.js
import { useEffect } from "react";

/**
 * useAlerts — опрашивает endpoint /alerts каждые `interval` мс
 * и выводит все принятые события через window.alert.
 * Если endpoint недоступен, выведет ошибку в консоль.
 *
 * @param {number} interval — интервал в миллисекундах
 */
export default function useAlerts(interval = 10000) {
  useEffect(() => {
    // Если вы используете proxy в package.json — API = ""
    // Иначе подставьте в .env REACT_APP_API_URL без http, 
    // и здесь сделайте: const API = `http://${process.env.REACT_APP_API_URL}`;
    const API = "";

    const checkAlerts = () => {
      console.log("[useAlerts] 🔄 polling /alerts");
      fetch(`${API}/alerts`)
        .then((res) => {
          console.log("[useAlerts] ← status", res.status);
          return res.json();
        })
        .then((data) => {
          console.log("[useAlerts] ← data", data);
          if (Array.isArray(data) && data.length > 0) {
            data.forEach((evt) => {
              console.log(`[useAlerts] ⚠️ alert: ${evt.message}`);
              window.alert(evt.message);
            });
          }
        })
        .catch((err) => {
          console.error("[useAlerts] ‼️ Error fetching alerts:", err);
        });
    };

    // сразу проверить, а потом по расписанию
    checkAlerts();
    const timerId = setInterval(checkAlerts, interval);
    return () => clearInterval(timerId);
  }, [interval]);

  // Возвращаем «пустой» компонент, чтобы хватало синтаксиса <AlertNotification/>
  const AlertNotification = () => null;
  return { AlertNotification };
}
