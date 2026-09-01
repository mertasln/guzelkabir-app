import { useEffect, useState } from "react";

// spec §11.1 "Atama Ekranı: ... SLA sayaç göstergesi" — geri sayımın
// gerçekten akması için render'dan bağımsız bir "şimdi" gerekiyor. Saniye
// hassasiyeti gerekmiyor (30 dk'lık bir pencere), bu yüzden 10sn'de bir.
export function useNow(intervalMs = 10_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
