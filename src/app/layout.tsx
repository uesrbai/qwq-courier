import type { Metadata } from "next";
import "./globals.css";
import { getI18n } from "@/lib/i18n/server";
import { LOCALE_HTML_LANG } from "@/lib/i18n/config";
import { I18nProvider } from "@/components/i18n-provider";

export const metadata: Metadata = {
  title: "QWQCourier · 消息分发",
  description: "QWQCourier —— 统一通知消息分发平台 / Unified notification platform",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { locale, dict } = await getI18n();
  return (
    <html lang={LOCALE_HTML_LANG[locale]} className="h-full">
      <body className="min-h-full">
        <I18nProvider locale={locale} dict={dict}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
