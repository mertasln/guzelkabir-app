"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

type Mode = "login" | "register";

function GirisForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, register } = useAuth();
  const nextPath = searchParams.get("next") ?? "/panel";

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function clearErr(key: string) {
    setErrors((e) => (e[key] ? { ...e, [key]: false } : e));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const nextErrors: Record<string, boolean> = {};
    if (!email.trim()) nextErrors.email = true;
    if (!password.trim()) nextErrors.password = true;
    if (mode === "register" && !fullName.trim()) nextErrors.fullName = true;
    if (mode === "register" && password.length < 10) nextErrors.password = true;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register({ email, password, fullName, phone: phone || undefined });
      }
      router.push(nextPath);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError("Bir şeyler ters gitti, lütfen tekrar deneyin.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = (key: string) => `input${errors[key] ? " invalid" : ""}`;
  const fieldCls = (key: string) => `field${errors[key] ? " show-err" : ""}`;

  return (
    <>
      <Topbar variant="flow" />
      <div className="section" style={{ display: "flex", justifyContent: "center" }}>
        <div className="wrap" style={{ maxWidth: 440 }}>
          <div className="aside-card">
            <h3>{mode === "login" ? "Giriş yapın" : "Hesap oluşturun"}</h3>
            <p className="sub" style={{ marginBottom: 20, color: "var(--ink-2)", fontSize: ".9rem" }}>
              {mode === "login"
                ? "Siparişinizi tamamlamak ve panelinize erişmek için giriş yapın."
                : "Kabir bakımı siparişi vermek için birkaç bilgiye ihtiyacımız var."}
            </p>

            <div className="seg" role="group" aria-label="Giriş / Kayıt">
              <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
                Giriş Yap
              </button>
              <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
                Kayıt Ol
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              {mode === "register" && (
                <div className={fieldCls("fullName")}>
                  <label htmlFor="fullName">Ad Soyad</label>
                  <input
                    className={inputCls("fullName")}
                    id="fullName"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      clearErr("fullName");
                    }}
                  />
                  <div className="err">Ad soyad gerekli.</div>
                </div>
              )}

              <div className={fieldCls("email")}>
                <label htmlFor="email">E-posta</label>
                <input
                  className={inputCls("email")}
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearErr("email");
                  }}
                />
                <div className="err">E-posta gerekli.</div>
              </div>

              {mode === "register" && (
                <div className="field">
                  <label htmlFor="phone">
                    Telefon <span className="hint">(opsiyonel, +90...)</span>
                  </label>
                  <input
                    className="input"
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              )}

              <div className={fieldCls("password")}>
                <label htmlFor="password">Şifre</label>
                <input
                  className={inputCls("password")}
                  id="password"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearErr("password");
                  }}
                />
                <div className="err">
                  {mode === "register" ? "Şifre en az 10 karakter olmalı." : "Şifre gerekli."}
                </div>
              </div>

              {formError && (
                <div className="err show" style={{ marginBottom: 14 }}>
                  {formError}
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={submitting}>
                {submitting ? "Gönderiliyor…" : mode === "login" ? "Giriş yap" : "Hesap oluştur"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default function GirisPage() {
  return (
    <Suspense>
      <GirisForm />
    </Suspense>
  );
}
