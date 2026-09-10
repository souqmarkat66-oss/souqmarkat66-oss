import { Component, type ReactNode } from "react";
import { isModuleLoadError } from "@/lib/loadModule";

export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    const downloadFailed = isModuleLoadError(this.state.error);
    return (
      <main dir="rtl" role="alert" className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border bg-background p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold mb-3">تعذر تحميل الصفحة</h1>
          <p className="text-muted-foreground mb-5">
            {downloadFailed
              ? "تعذر تنزيل ملفات الصفحة. تحقق من اتصالك ثم أعد تحميل الصفحة للحصول على أحدث نسخة."
              : "حدث خطأ أثناء عرض الصفحة. يمكنك إعادة تحميلها أو العودة للرئيسية."}
          </p>
          <p className="text-sm text-muted-foreground mb-5">
            إذا كنت قد أرسلت طلب دفع، راجع حالته قبل محاولة الدفع مرة أخرى.
          </p>
          <button type="button" onClick={() => window.location.reload()}
            className="rounded-lg bg-primary px-4 py-2 text-primary-foreground font-bold">
            إعادة تحميل الصفحة
          </button>
          <a href="/" className="block mt-4 underline">العودة للرئيسية</a>
        </div>
      </main>
    );
  }
}