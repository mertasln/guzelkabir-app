import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";

export function DashboardPage() {
  const { user } = useAuth();
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Panel</h1>
      <Card>
        <p className="text-sm text-[var(--muted-foreground)]">
          Hoş geldiniz{user?.fullName ? `, ${user.fullName}` : ""}. Soldaki menüden bir modül
          seçin.
        </p>
      </Card>
    </div>
  );
}
