"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "홈" },
  { href: "/write", label: "글쓰기" },
  { href: "/mypage", label: "내 정보" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <>
      {/* 컴퓨터 화면: 위쪽 메뉴 */}
      <header className="sticky top-0 z-10 hidden border-b border-gray-200 bg-white/90 backdrop-blur md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-3">
          <Link href="/" className="text-xl font-bold text-blue-600">
            sharefit
          </Link>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              if (item.href === "/write") {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="ml-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                  >
                    + {item.label}
                  </Link>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-2 text-sm hover:bg-gray-100 ${
                    active ? "font-semibold text-blue-600" : "text-gray-600"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* 휴대폰 화면: 아래쪽 메뉴 */}
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-gray-200 bg-white md:hidden">
        <div className="mx-auto flex max-w-md">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 py-3 text-center text-sm ${
                  active ? "font-semibold text-blue-600" : "text-gray-500"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
