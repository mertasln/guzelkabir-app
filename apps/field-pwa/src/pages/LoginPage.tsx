import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

// spec §12.1 madde 25: field partnerleri için telefon+OTP öngörülüyor
// ("düşük teknik okuryazarlık senaryosuna uygun"). Kullanıcı kararıyla ADIM
// 8'de bilinçli olarak ertelendi (gerçek SMS altyapısı yok, sahte/simüle bir
// OTP akışı da istenmedi) — CLAUDE.md'de "tracked spec deviation" olarak
// işaretli. Mevcut email+parola akışı (apps/api/src/auth) burada kullanılıyor.
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate("/gorevler", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Giriş başarısız oldu.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--muted)] p-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold">GüzelKabir Saha</h1>
        <p className="mb-6 text-sm text-[var(--muted-foreground)]">Saha partneri girişi</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            type="email"
            placeholder="E-posta"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Parola"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? "Giriş yapılıyor…" : "Giriş Yap"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
